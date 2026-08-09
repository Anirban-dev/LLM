"""
quantize.py — shrink the trained model

    python quantize.py            # 4-bit, default, best size/quality trade-off
    python quantize.py --bits 8   # native INT8, also faster on CPU
    python quantize.py --bits 2   # smallest, noticeably worse answers

4-bit and 2-bit are custom (quant_utils.py) since PyTorch only has a
native kernel for 8-bit. Embedding tables stay fp32 either way.
"""

import argparse
import json
import os

import torch
from model import MiniGPT
from quant_utils import quantize_model_


def load_trained_model(checkpoint_dir):
    with open(os.path.join(checkpoint_dir, "meta.json")) as f:
        meta = json.load(f)
    ckpt_path = os.path.join(checkpoint_dir, "model_best.pt")
    if not os.path.exists(ckpt_path):
        raise FileNotFoundError(f"No trained checkpoint at {ckpt_path}. Run train.py first.")
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    cfg = ckpt["config"]

    model = MiniGPT(
        vocab_size=meta["vocab_size"],
        embed_dim=cfg["embed_dim"],
        n_heads=cfg["n_heads"],
        n_layers=cfg["n_layers"],
        block_size=meta["block_size"],
        dropout=0.0,
        grad_checkpoint=False,
    )
    model.load_state_dict(ckpt["model"])
    model.eval()
    return model, meta, cfg, ckpt.get("val_loss")


def main(checkpoint_dir, bits, group_size):
    model, meta, cfg, val_loss = load_trained_model(checkpoint_dir)
    fp32_size = sum(p.numel() * p.element_size() for p in model.parameters())

    if bits == 8:
        quantized = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
        out_name = "model_int8.pt"
        payload = {"model": quantized.state_dict(), "quant_bits": 8}
    else:
        if bits == 2:
            print("WARNING: --bits 2 measurably degrades output quality on a model this "
                  "size (see quantize.py docstring). Consider --bits 4 unless you're "
                  "specifically evaluating the trade-off.")
        n_layers_quantized, orig_bytes, packed_bytes = quantize_model_(
            model, bits=bits, group_size=group_size
        )
        print(f"Quantized {n_layers_quantized} Linear layers "
              f"({orig_bytes/1e6:.2f} MB fp32 -> {packed_bytes/1e6:.2f} MB packed, "
              f"{orig_bytes/packed_bytes:.2f}x)")
        out_name = f"model_int{bits}.pt"
        payload = {"model": model.state_dict(), "quant_bits": bits, "group_size": group_size}

    payload.update({"config": cfg, "meta": meta, "val_loss": val_loss, "quantized": True})
    out_path = os.path.join(checkpoint_dir, out_name)
    torch.save(payload, out_path)

    int_size = os.path.getsize(out_path)
    print(f"FP32 params size : {fp32_size/1e6:.1f} MB")
    print(f"INT{bits} file size   : {int_size/1e6:.1f} MB  ({fp32_size/int_size:.1f}x smaller than fp32)")
    print(f"Saved -> {out_path}")
    print(f"Run:  python chat.py --quantized --bits {bits}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint_dir", default="checkpoints")
    ap.add_argument("--bits", type=int, choices=(2, 4, 8), default=4,
                     help="Quantization bit-width. 4 (default) is the recommended "
                          "size/quality trade-off; 8 is native-kernel CPU-fast; "
                          "2 is smallest but noticeably lossier. See docstring.")
    ap.add_argument("--group_size", type=int, default=64,
                     help="Quantization group size for --bits 4/2 (ignored for --bits 8). "
                          "Smaller = more accurate, slightly more scale/zero-point overhead.")
    args = ap.parse_args()
    main(args.checkpoint_dir, args.bits, args.group_size)
