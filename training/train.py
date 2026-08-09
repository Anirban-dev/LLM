"""
train.py — Stage 2: instruction tuning (run after prepare_data.py)

    python train.py --init_from checkpoints/model_pretrained.pt
    python train.py --resume

FP16, dynamic padding, early stopping, checkpoints saved on every
improvement (safe to resume after a Colab disconnect).
"""

import argparse
import json
import os
import time

import torch
from torch.nn.utils.rnn import pad_sequence
from torch.utils.data import DataLoader, Dataset
from torch.cuda.amp import autocast, GradScaler

from model import MiniGPT


CONFIG = {
    # Model — MUST match pretrain.py's CONFIG exactly (weight hand-off via
    # --init_from loads a state_dict with these exact shapes). 448/8/8
    # (~23M params) — matched to TinyStories + Dolly's token budget.
    "embed_dim"          : 448,
    "n_heads"             : 8,
    "n_layers"            : 8,
    "dropout"             : 0.1,

    "batch_size"          : 64,       # real batch per step
    "accumulation_steps"  : 1,        # effective batch = 64
    "learning_rate"       : 3e-4,
    "warmup_steps"        : 200,
    "max_iters"           : 8000,
    "eval_every"          : 200,
    "eval_iters"          : 40,
    "patience"            : 8,        # stop after this many evals with no val improvement
    "save_every"          : 500,      # unconditional autosave, for Colab disconnect safety
    "grad_clip"           : 1.0,

    # Memory / speed
    "use_fp16"            : True,     # T4-appropriate (no bf16 tensor cores on Turing)
    "grad_checkpoint"     : False,    # model is small enough it isn't needed on a T4
    "use_compile"         : True,     # torch.compile — free speedup on PyTorch 2.x
    "num_workers"         : 0,        # dataset is already tokenized tensors sitting in
                                       # RAM — __getitem__ is a plain index, not disk I/O
                                       # or augmentation. Spawning worker processes for
                                       # that adds fork + IPC/pickling overhead that costs
                                       # more than the trivial work it parallelizes. Raise
                                       # this only if profiling shows the GPU stalling on
                                       # data (unlikely at this dataset size).
}


class PackedDataset(Dataset):
    def __init__(self, examples):
        self.examples = examples

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        return self.examples[idx]


def make_collate_fn(pad_id):
    def collate(batch):
        ids    = [x[0] for x in batch]
        labels = [x[1] for x in batch]
        ids    = pad_sequence(ids, batch_first=True, padding_value=pad_id)
        labels = pad_sequence(labels, batch_first=True, padding_value=-100)
        return ids, labels
    return collate


def get_lr(step, config):
    if step < config["warmup_steps"]:
        return config["learning_rate"] * (step + 1) / config["warmup_steps"]
    progress = (step - config["warmup_steps"]) / max(1, config["max_iters"] - config["warmup_steps"])
    progress = min(progress, 1.0)
    import math
    return config["learning_rate"] * 0.5 * (1 + math.cos(math.pi * progress))


@torch.no_grad()
def estimate_loss(model, loader, config, device, use_fp16, max_batches):
    model.eval()
    losses = []
    it = iter(loader)
    for _ in range(max_batches):
        try:
            x, y = next(it)
        except StopIteration:
            it = iter(loader)
            x, y = next(it)
        x, y = x.to(device), y.to(device)
        if use_fp16:
            with autocast():
                _, loss = model(x, y)
        else:
            _, loss = model(x, y)
        losses.append(loss.item())
    model.train()
    return sum(losses) / len(losses)


def cycle(loader):
    while True:
        for batch in loader:
            yield batch


def train(checkpoint_dir="checkpoints", resume=False, init_from=None):
    device   = "cuda" if torch.cuda.is_available() else "cpu"
    use_fp16 = CONFIG["use_fp16"] and device == "cuda"

    meta_path = os.path.join(checkpoint_dir, "meta.json")
    if not os.path.exists(meta_path):
        raise FileNotFoundError(
            "No prepared dataset found. Run `python prepare_data.py --dataset dolly` first."
        )
    with open(meta_path) as f:
        meta = json.load(f)

    train_examples = torch.load(os.path.join(checkpoint_dir, "train_data.pt"))
    val_examples   = torch.load(os.path.join(checkpoint_dir, "val_data.pt"))
    collate = make_collate_fn(meta["pad_id"])

    train_loader = DataLoader(
        PackedDataset(train_examples), batch_size=CONFIG["batch_size"],
        shuffle=True, collate_fn=collate, num_workers=CONFIG["num_workers"],
        pin_memory=(device == "cuda"), drop_last=True,
    )
    val_loader = DataLoader(
        PackedDataset(val_examples), batch_size=CONFIG["batch_size"],
        shuffle=True, collate_fn=collate, num_workers=0,
        pin_memory=(device == "cuda"), drop_last=False,
    )
    train_iter = cycle(train_loader)

    model = MiniGPT(
        vocab_size      = meta["vocab_size"],
        embed_dim       = CONFIG["embed_dim"],
        n_heads         = CONFIG["n_heads"],
        n_layers        = CONFIG["n_layers"],
        block_size      = meta["block_size"],
        dropout         = CONFIG["dropout"],
        grad_checkpoint = CONFIG["grad_checkpoint"],
    ).to(device)

    if CONFIG["use_compile"] and hasattr(torch, "compile") and device == "cuda":
        model = torch.compile(model)

    optimizer = torch.optim.AdamW(model.parameters(), lr=CONFIG["learning_rate"],
                                   betas=(0.9, 0.95), weight_decay=0.1)
    scaler = GradScaler(enabled=use_fp16)

    resume_path = os.path.join(checkpoint_dir, "model_resume.pt")
    start_iter, best_val_loss, no_improve_evals = 0, float("inf"), 0
    if resume and os.path.exists(resume_path):
        ckpt = torch.load(resume_path, map_location=device, weights_only=False)
        (model._orig_mod if hasattr(model, "_orig_mod") else model).load_state_dict(ckpt["model"])
        optimizer.load_state_dict(ckpt["optimizer"])
        start_iter     = ckpt["iter"] + 1
        best_val_loss  = ckpt["val_loss"]
        print(f"Resumed from step {start_iter} (best val_loss={best_val_loss:.4f})")
    elif init_from:
        # Stage-2 instruction tuning: start from Stage-1 raw-text pretrained
        # weights instead of random init. --resume takes priority over this
        # if a Dolly-stage checkpoint already exists (don't throw away
        # in-progress fine-tuning).
        if not os.path.exists(init_from):
            raise FileNotFoundError(f"--init_from checkpoint not found: {init_from}")
        ckpt = torch.load(init_from, map_location=device, weights_only=False)
        pre_meta = ckpt.get("meta", {})
        if pre_meta.get("vocab_size") != meta["vocab_size"]:
            raise ValueError(
                f"Vocab size mismatch: pretrained checkpoint has "
                f"{pre_meta.get('vocab_size')}, current tokenizer has "
                f"{meta['vocab_size']}. Re-run prepare_data.py with "
                f"--reuse_tokenizer so both stages share one vocabulary."
            )
        if pre_meta.get("block_size") != meta["block_size"]:
            raise ValueError(
                f"block_size mismatch: pretrained checkpoint used "
                f"{pre_meta.get('block_size')}, current data was packed with "
                f"{meta['block_size']}. Use the same --block_size for "
                f"prepare_pretrain_data.py and prepare_data.py."
            )
        (model._orig_mod if hasattr(model, "_orig_mod") else model).load_state_dict(ckpt["model"])
        print(f"Initialized from pretrained checkpoint: {init_from} "
              f"(pretrain val_loss={ckpt.get('val_loss', float('nan')):.4f})")

    total_params = model.count_parameters() if hasattr(model, "count_parameters") else sum(p.numel() for p in model.parameters())
    print(f"\n{'='*55}")
    print(f"  Device        : {device}")
    print(f"  Model         : {total_params:,} parameters ({total_params/1e6:.2f}M)")
    print(f"  FP16          : {'on' if use_fp16 else 'off'}")
    print(f"  Effective batch: {CONFIG['batch_size']} x {CONFIG['accumulation_steps']} = {CONFIG['batch_size']*CONFIG['accumulation_steps']}")
    print(f"  Train examples : {len(train_examples):,}   Val examples: {len(val_examples):,}")
    print(f"{'='*55}\n")

    def save_checkpoint(step, val_loss, tag):
        raw_model = model._orig_mod if hasattr(model, "_orig_mod") else model
        torch.save({
            "model"     : raw_model.state_dict(),
            "optimizer" : optimizer.state_dict(),
            "config"    : CONFIG,
            "meta"      : meta,
            "iter"      : step,
            "val_loss"  : val_loss,
        }, os.path.join(checkpoint_dir, f"model_{tag}.pt"))

    t0 = time.time()
    for step in range(start_iter, CONFIG["max_iters"]):
        lr = get_lr(step, CONFIG)
        for g in optimizer.param_groups:
            g["lr"] = lr

        optimizer.zero_grad(set_to_none=True)
        for _ in range(CONFIG["accumulation_steps"]):
            x, y = next(train_iter)
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            if use_fp16:
                with autocast():
                    _, loss = model(x, y)
                    loss = loss / CONFIG["accumulation_steps"]
                scaler.scale(loss).backward()
            else:
                _, loss = model(x, y)
                loss = loss / CONFIG["accumulation_steps"]
                loss.backward()

        if use_fp16:
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), CONFIG["grad_clip"])
            scaler.step(optimizer)
            scaler.update()
        else:
            torch.nn.utils.clip_grad_norm_(model.parameters(), CONFIG["grad_clip"])
            optimizer.step()

        if step % CONFIG["eval_every"] == 0 or step == CONFIG["max_iters"] - 1:
            n_val_batches = max(1, min(CONFIG["eval_iters"], len(val_loader)))
            val_loss = estimate_loss(model, val_loader, CONFIG, device, use_fp16, n_val_batches)
            elapsed = time.time() - t0
            print(f"step {step:6d}/{CONFIG['max_iters']} | "
                  f"train: {loss.item()*CONFIG['accumulation_steps']:.4f} | "
                  f"val: {val_loss:.4f} | lr: {lr:.2e} | elapsed: {elapsed:.1f}s")

            if val_loss < best_val_loss:
                best_val_loss, no_improve_evals = val_loss, 0
                save_checkpoint(step, best_val_loss, "best")
                print(f"  new best (val={best_val_loss:.4f}) -> model_best.pt")
            else:
                no_improve_evals += 1
                if no_improve_evals >= CONFIG["patience"]:
                    print(f"\nEarly stopping: no improvement for {CONFIG['patience']} evals.")
                    break

        if step % CONFIG["save_every"] == 0 and step > 0:
            save_checkpoint(step, best_val_loss, "resume")

    save_checkpoint(step, best_val_loss, "resume")
    print(f"\nTraining complete. Best val loss: {best_val_loss:.4f}")
    print("Run:  python chat.py")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Mini LLM")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--checkpoint_dir", default="checkpoints")
    parser.add_argument("--init_from", default=None,
                         help="Path to a Stage-1 pretrained checkpoint "
                              "(e.g. checkpoints/model_pretrained.pt) to "
                              "initialize weights from before instruction "
                              "tuning, instead of random init.")
    args = parser.parse_args()
    train(checkpoint_dir=args.checkpoint_dir, resume=args.resume, init_from=args.init_from)
