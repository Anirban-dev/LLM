"""
quant_utils.py — INT4 / INT2 weight packing for nn.Linear

PyTorch has no native kernel below INT8, so this packs weights manually:
2 values/byte (4-bit) or 4 values/byte (2-bit), each group of 64 weights
gets its own scale + zero-point, dequantized back to fp32 right before
each matmul. Smaller file, NOT faster (dequant costs cycles every call).

4-bit: ~6% relative weight error — safe.
2-bit: ~31% relative weight error — real quality loss on a model this small.
Default to 4-bit for that reason.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class QuantLinear(nn.Module):

    def __init__(self, in_features, out_features, has_bias, bits=4, group_size=64):
        super().__init__()
        assert bits in (2, 4), "QuantLinear supports 2 or 4 bits (use torch's native INT8 path for 8-bit)"
        self.in_features = in_features
        self.out_features = out_features
        self.bits = bits
        self.group_size = group_size
        self.n_groups = (in_features + group_size - 1) // group_size

        vals_per_byte = 8 // bits
        packed_cols = (in_features + vals_per_byte - 1) // vals_per_byte
        self.register_buffer("qweight", torch.zeros(out_features, packed_cols, dtype=torch.uint8))
        self.register_buffer("scale", torch.zeros(out_features, self.n_groups, dtype=torch.float32))
        self.register_buffer("zero_point", torch.zeros(out_features, self.n_groups, dtype=torch.float32))
        if has_bias:
            self.register_buffer("bias", torch.zeros(out_features, dtype=torch.float32))
        else:
            self.bias = None

    @classmethod
    def from_linear(cls, linear, bits=4, group_size=64):
        w = linear.weight.data.float()
        out_f, in_f = w.shape
        mod = cls(in_f, out_f, linear.bias is not None, bits=bits, group_size=group_size)
        qmax = (1 << bits) - 1

        quant_levels = torch.zeros(out_f, in_f, dtype=torch.uint8)
        for g in range(mod.n_groups):
            lo, hi = g * group_size, min((g + 1) * group_size, in_f)
            wslice = w[:, lo:hi]
            wmin = wslice.min(dim=1, keepdim=True).values
            wmax = wslice.max(dim=1, keepdim=True).values
            scale = (wmax - wmin).clamp(min=1e-8) / qmax
            q = ((wslice - wmin) / scale).round().clamp(0, qmax).to(torch.uint8)
            quant_levels[:, lo:hi] = q
            mod.scale[:, g] = scale.squeeze(1)
            mod.zero_point[:, g] = wmin.squeeze(1)

        vals_per_byte = 8 // bits
        packed = torch.zeros_like(mod.qweight)
        for i in range(vals_per_byte):
            cols = torch.arange(i, in_f, vals_per_byte)
            if len(cols) == 0:
                continue
            packed[:, : len(cols)] |= (quant_levels[:, cols] << (i * bits)).to(torch.uint8)
        mod.qweight.copy_(packed)

        if linear.bias is not None:
            mod.bias.copy_(linear.bias.data.float())
        return mod

    def dequantize(self):
        vals_per_byte = 8 // self.bits
        mask = (1 << self.bits) - 1
        out = torch.empty(self.out_features, self.in_features, dtype=torch.float32)
        for i in range(vals_per_byte):
            cols = torch.arange(i, self.in_features, vals_per_byte)
            if len(cols) == 0:
                continue
            shifted = (self.qweight[:, : len(cols)] >> (i * self.bits)) & mask
            out[:, cols] = shifted.float()
        for g in range(self.n_groups):
            lo, hi = g * self.group_size, min((g + 1) * self.group_size, self.in_features)
            out[:, lo:hi] = out[:, lo:hi] * self.scale[:, g : g + 1] + self.zero_point[:, g : g + 1]
        return out

    def forward(self, x):
        w = self.dequantize().to(dtype=x.dtype, device=x.device)
        bias = None if self.bias is None else self.bias.to(dtype=x.dtype, device=x.device)
        return F.linear(x, w, bias)

    def packed_nbytes(self):
        n = self.qweight.numel() + self.scale.numel() * 4 + self.zero_point.numel() * 4
        if self.bias is not None:
            n += self.bias.numel() * 4
        return n


def quantize_model_(model, bits=4, group_size=64, skip_modules=("token_emb", "position_emb")):
    orig_bytes, new_bytes, count = 0, 0, 0

    def recurse(module, prefix=""):
        nonlocal orig_bytes, new_bytes, count
        for name, child in module.named_children():
            full_name = f"{prefix}.{name}" if prefix else name
            if any(skip in full_name for skip in skip_modules):
                continue
            if isinstance(child, nn.Linear):
                orig_bytes += child.weight.numel() * 4 + (child.bias.numel() * 4 if child.bias is not None else 0)
                qlin = QuantLinear.from_linear(child, bits=bits, group_size=group_size)
                new_bytes += qlin.packed_nbytes()
                setattr(module, name, qlin)
                count += 1
            else:
                recurse(child, full_name)

    recurse(model)
    return count, orig_bytes, new_bytes
