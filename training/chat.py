"""
chat.py — Talk to Your Trained Mini LLM (v2)
===============================================
Run:  python chat.py                          (interactive, GPU if available)
      python chat.py --prompt "..."
      python chat.py --quantized              (load the INT8 CPU model made by quantize.py)
"""

import argparse
import json
import os

import torch
from tokenizers import Tokenizer

from model import MiniGPT
from quant_utils import quantize_model_


def load_tokenizer(checkpoint_dir):
    tok_path = os.path.join(checkpoint_dir, "tokenizer.json")
    if not os.path.exists(tok_path):
        print("No tokenizer found. Run prepare_data.py first.")
        exit(1)
    return Tokenizer.from_file(tok_path)


def load_model(checkpoint_dir, device, quantized=False, bits=4):
    meta_path = os.path.join(checkpoint_dir, "meta.json")
    with open(meta_path) as f:
        meta = json.load(f)

    ckpt_name = f"model_int{bits}.pt" if quantized else "model_best.pt"
    ckpt_path = os.path.join(checkpoint_dir, ckpt_name)
    if not os.path.exists(ckpt_path):
        print(f"No checkpoint found at {ckpt_path}. Train first "
              f"(and run `python quantize.py --bits {bits}` for --quantized).")
        exit(1)

    ckpt = torch.load(ckpt_path, map_location="cpu" if quantized else device, weights_only=False)
    cfg  = ckpt["config"]

    model = MiniGPT(
        vocab_size      = meta["vocab_size"],
        embed_dim       = cfg["embed_dim"],
        n_heads         = cfg["n_heads"],
        n_layers        = cfg["n_layers"],
        block_size      = meta["block_size"],
        dropout         = 0.0,
        grad_checkpoint = False,
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


def generate(model, tokenizer, meta, instruction, context="", max_new_tokens=200,
             temperature=0.8, top_k=40, top_p=0.9, repetition_penalty=1.2, device="cpu"):
    prompt = build_prompt(instruction, context)
    encoded = tokenizer.encode(prompt).ids
    idx = torch.tensor([encoded], dtype=torch.long, device=device)
    eos_id = meta["eos_id"]

    with torch.no_grad():
        out = model.generate(
            idx, max_new_tokens,
            temperature=temperature, top_k=top_k, top_p=top_p,
            repetition_penalty=repetition_penalty, eos_token_id=eos_id,
        )

    new_tokens = out[0, len(encoded):].tolist()
    if eos_id in new_tokens:
        new_tokens = new_tokens[:new_tokens.index(eos_id)]
    return tokenizer.decode(new_tokens).strip()


def interactive_mode(model, tokenizer, meta, device):
    print("\n" + "=" * 55)
    print("  MINI LLM — Interactive Chat")
    print("=" * 55)
    print("Type an instruction. Commands: /temp 0.8  /tokens 200  /quit")
    print("=" * 55)

    temperature, max_new_tokens = 0.8, 200

    while True:
        try:
            prompt = input("\nYou -> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break
        if not prompt:
            continue
        if prompt.startswith("/quit"):
            break
        if prompt.startswith("/temp"):
            temperature = float(prompt.split()[1])
            continue
        if prompt.startswith("/tokens"):
            max_new_tokens = int(prompt.split()[1])
            continue

        print("AI  -> ", end="", flush=True)
        result = generate(model, tokenizer, meta, prompt,
                           max_new_tokens=max_new_tokens, temperature=temperature, device=device)
        print(result)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", type=str, default=None)
    parser.add_argument("--context", type=str, default="")
    parser.add_argument("--tokens", type=int, default=200)
    parser.add_argument("--temp", type=float, default=0.8)
    parser.add_argument("--quantized", action="store_true",
                         help="Load the quantized CPU model produced by quantize.py")
    parser.add_argument("--bits", type=int, choices=(2, 4, 8), default=4,
                         help="Which quantized checkpoint to load (must match what "
                              "you passed to quantize.py --bits). Ignored without --quantized.")
    parser.add_argument("--checkpoint_dir", default="checkpoints")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = load_tokenizer(args.checkpoint_dir)
    model, meta, device = load_model(args.checkpoint_dir, device, quantized=args.quantized, bits=args.bits)

    if args.prompt:
        result = generate(model, tokenizer, meta, args.prompt, args.context,
                           max_new_tokens=args.tokens, temperature=args.temp, device=device)
        print(result)
    else:
        interactive_mode(model, tokenizer, meta, device)
