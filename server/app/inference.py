"""
inference.py — model/tokenizer loading and generation, adapted from the
training project's chat.py. This is the only file that talks to the model
directly; server.py just calls into this.
"""

import json
import os

import torch
from torch.nn import functional as F
from tokenizers import Tokenizer

from app.model import MiniGPT
from app.quant_utils import quantize_model_


def load_tokenizer(checkpoint_dir):
    tok_path = os.path.join(checkpoint_dir, "tokenizer.json")
    if not os.path.exists(tok_path):
        raise FileNotFoundError(
            f"No tokenizer.json found at {tok_path}. Copy it over from your "
            f"training project's checkpoints/ folder."
        )
    return Tokenizer.from_file(tok_path)


def load_model(checkpoint_dir, device, quantized=False, bits=4):
    meta_path = os.path.join(checkpoint_dir, "meta.json")
    if not os.path.exists(meta_path):
        raise FileNotFoundError(
            f"No meta.json found at {meta_path}. Copy it over from your "
            f"training project's checkpoints/ folder."
        )
    with open(meta_path) as f:
        meta = json.load(f)

    ckpt_name = f"model_int{bits}.pt" if quantized else "model_best.pt"
    ckpt_path = os.path.join(checkpoint_dir, ckpt_name)
    if not os.path.exists(ckpt_path):
        raise FileNotFoundError(
            f"No checkpoint found at {ckpt_path}. Copy your trained "
            f"{ckpt_name} into {checkpoint_dir}/ from the training project "
            f"(run quantize.py there first if you want a quantized file)."
        )

    ckpt = torch.load(ckpt_path, map_location="cpu" if quantized else device, weights_only=False)
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

    if quantized:
        device = "cpu"
        if bits == 8:
            model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
            model.load_state_dict(ckpt["model"])
        else:
            quantize_model_(model, bits=bits, group_size=ckpt.get("group_size", 64))
            model.load_state_dict(ckpt["model"])
    else:
        model.load_state_dict(ckpt["model"])

    model.to(device)
    model.eval()

    n_params = sum(p.numel() for p in model.parameters())
    label = f"INT{bits}/CPU" if quantized else device
    print(f"Model loaded ({label}) — {n_params:,} params, "
          f"val_loss={ckpt.get('val_loss', float('nan')):.4f}")
    return model, meta, device


def build_prompt(instruction, context=""):
    if context:
        return (f"### Instruction:\n{instruction}\n\n"
                f"### Context:\n{context}\n\n"
                f"### Response:\n")
    return f"### Instruction:\n{instruction}\n\n### Response:\n"


@torch.no_grad()
def generate(model, tokenizer, meta, instruction, context="", max_new_tokens=200,
             temperature=0.8, top_k=40, top_p=0.9, repetition_penalty=1.2, device="cpu"):
    """Non-streaming generation — same logic as chat.py's generate()."""
    prompt = build_prompt(instruction, context)
    encoded = tokenizer.encode(prompt).ids
    idx = torch.tensor([encoded], dtype=torch.long, device=device)
    eos_id = meta["eos_id"]

    out = model.generate(
        idx, max_new_tokens,
        temperature=temperature, top_k=top_k, top_p=top_p,
        repetition_penalty=repetition_penalty, eos_token_id=eos_id,
    )

    new_tokens = out[0, len(encoded):].tolist()
    if eos_id in new_tokens:
        new_tokens = new_tokens[:new_tokens.index(eos_id)]
    prompt_tokens = len(encoded)
    return tokenizer.decode(new_tokens).strip(), prompt_tokens, len(new_tokens)


@torch.no_grad()
def stream_generate(model, tokenizer, meta, instruction, context="", max_new_tokens=200,
                     temperature=0.8, top_k=40, top_p=0.9, repetition_penalty=1.2, device="cpu"):
    """
    Token-by-token generator for SSE streaming. This duplicates
    MiniGPT.generate()'s sampling loop (model.py) instead of calling it,
    because that method only returns the full sequence at the end — this
    version yields each new token's decoded text as it's produced.
    """
    prompt = build_prompt(instruction, context)
    encoded = tokenizer.encode(prompt).ids
    idx = torch.tensor([encoded], dtype=torch.long, device=device)
    eos_id = meta["eos_id"]

    ctx = idx[:, -model.block_size:]
    logits, _, past_kv = model(ctx, use_cache=True)

    for _ in range(max_new_tokens):
        step_logits = logits[:, -1, :] / max(temperature, 1e-5)

        if repetition_penalty != 1.0:
            seen = torch.unique(idx[0])
            step_logits[0, seen] /= repetition_penalty

        if top_k is not None:
            v, _ = torch.topk(step_logits, min(top_k, step_logits.size(-1)))
            step_logits[step_logits < v[:, [-1]]] = float("-inf")

        if top_p is not None:
            sorted_logits, sorted_idx = torch.sort(step_logits, descending=True, dim=-1)
            probs = F.softmax(sorted_logits, dim=-1)
            cum_probs = torch.cumsum(probs, dim=-1)
            remove = cum_probs > top_p
            remove[..., 1:] = remove[..., :-1].clone()
            remove[..., 0] = False
            sorted_logits[remove] = float("-inf")
            step_logits = torch.full_like(step_logits, float("-inf")).scatter(
                -1, sorted_idx, sorted_logits
            )

        probs = F.softmax(step_logits, dim=-1)
        next_token = torch.multinomial(probs, num_samples=1)
        idx = torch.cat([idx, next_token], dim=1)

        token_id = next_token.item()
        if eos_id is not None and token_id == eos_id:
            break

        yield tokenizer.decode([token_id])

        cache_len = past_kv[0][0].shape[2]
        if cache_len >= model.block_size:
            ctx = idx[:, -model.block_size:]
            logits, _, past_kv = model(ctx, use_cache=True)
        else:
            logits, _, past_kv = model(next_token, past_kv=past_kv, use_cache=True)
