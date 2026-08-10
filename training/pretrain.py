"""
pretrain.py — Stage 1: raw-text pretraining (run after prepare_pretrain_data.py)

    python pretrain.py
    python pretrain.py --resume

Every token trains (no prompt/response split — that's Stage 2). Same
FP16 setup and checkpointing as train.py.
"""

import argparse
import math
import os
import time

import torch
from torch.utils.data import DataLoader, Dataset
from torch.cuda.amp import autocast, GradScaler

from model import MiniGPT


CONFIG = {
    "embed_dim"          : 448,
    "n_heads"             : 8,
    "n_layers"            : 8,
    "dropout"             : 0.1,

    "batch_size"          : 64,
    "accumulation_steps"  : 1,        # effective batch = 64
    "learning_rate"       : 3e-4,
    "warmup_steps"        : 400,
    "max_iters"            : 18000,
    "eval_every"           : 250,
    "eval_iters"            : 40,
    "patience"              : 10,
    "save_every"            : 500,
    "grad_clip"             : 1.0,

    "use_fp16"            : True,
    "grad_checkpoint"     : False,
    "use_compile"         : True,
    "num_workers"         : 0,
}


class BlockDataset(Dataset):
    """Fixed-length token blocks — inputs are ids[:-1], targets are ids[1:]."""

    def __init__(self, blocks):
        self.blocks = blocks

    def __len__(self):
        return len(self.blocks)

    def __getitem__(self, idx):
        block = self.blocks[idx]
        return block[:-1], block[1:]


def get_lr(step, config):
    if step < config["warmup_steps"]:
        return config["learning_rate"] * (step + 1) / config["warmup_steps"]
    progress = (step - config["warmup_steps"]) / max(1, config["max_iters"] - config["warmup_steps"])
    progress = min(progress, 1.0)
    return config["learning_rate"] * 0.5 * (1 + math.cos(math.pi * progress))


@torch.no_grad()
def estimate_loss(model, loader, device, use_fp16, max_batches):
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


def pretrain(checkpoint_dir="checkpoints", resume=False):
    device   = "cuda" if torch.cuda.is_available() else "cpu"
    use_fp16 = CONFIG["use_fp16"] and device == "cuda"

    train_path = os.path.join(checkpoint_dir, "pretrain_train_data.pt")
    val_path   = os.path.join(checkpoint_dir, "pretrain_val_data.pt")
    if not os.path.exists(train_path):
        raise FileNotFoundError(
            "No prepared pretraining data found. Run "
            "`python prepare_pretrain_data.py` first."
        )

    train_blocks = torch.load(train_path)
    val_blocks   = torch.load(val_path)
    block_size   = train_blocks[0].shape[0] - 1

    from tokenizers import Tokenizer
    tok = Tokenizer.from_file(os.path.join(checkpoint_dir, "tokenizer.json"))
    vocab_size = tok.get_vocab_size()

    train_loader = DataLoader(
        BlockDataset(train_blocks), batch_size=CONFIG["batch_size"],
        shuffle=True, num_workers=CONFIG["num_workers"],
        pin_memory=(device == "cuda"), drop_last=True,
    )
    val_loader = DataLoader(
        BlockDataset(val_blocks), batch_size=CONFIG["batch_size"],
        shuffle=True, num_workers=0,
        pin_memory=(device == "cuda"), drop_last=False,
    )
    train_iter = cycle(train_loader)

    model = MiniGPT(
        vocab_size      = vocab_size,
        embed_dim       = CONFIG["embed_dim"],
        n_heads         = CONFIG["n_heads"],
        n_layers        = CONFIG["n_layers"],
        block_size      = block_size,
        dropout         = CONFIG["dropout"],
        grad_checkpoint = CONFIG["grad_checkpoint"],
    ).to(device)

    if CONFIG["use_compile"] and hasattr(torch, "compile") and device == "cuda":
        model = torch.compile(model)

    optimizer = torch.optim.AdamW(model.parameters(), lr=CONFIG["learning_rate"],
                                   betas=(0.9, 0.95), weight_decay=0.1)
    scaler = GradScaler(enabled=use_fp16)

    resume_path = os.path.join(checkpoint_dir, "model_pretrain_resume.pt")
    start_iter, best_val_loss, no_improve_evals = 0, float("inf"), 0
    if resume and os.path.exists(resume_path):
        ckpt = torch.load(resume_path, map_location=device, weights_only=False)
        (model._orig_mod if hasattr(model, "_orig_mod") else model).load_state_dict(ckpt["model"])
        optimizer.load_state_dict(ckpt["optimizer"])
        start_iter     = ckpt["iter"] + 1
        best_val_loss  = ckpt["val_loss"]
        print(f"Resumed from step {start_iter} (best val_loss={best_val_loss:.4f})")

    total_params = model.count_parameters() if hasattr(model, "count_parameters") else sum(p.numel() for p in model.parameters())
    print(f"\n{'='*55}")
    print(f"  STAGE 1: Raw-text pretraining")
    print(f"  Device        : {device}")
    print(f"  Model         : {total_params:,} parameters ({total_params/1e6:.2f}M)")
    print(f"  Vocab size    : {vocab_size:,}")
    print(f"  Block size    : {block_size}")
    print(f"  FP16          : {'on' if use_fp16 else 'off'}")
    print(f"  Effective batch: {CONFIG['batch_size']} x {CONFIG['accumulation_steps']} = {CONFIG['batch_size']*CONFIG['accumulation_steps']}")
    print(f"  Train blocks  : {len(train_blocks):,}   Val blocks: {len(val_blocks):,}")
    print(f"{'='*55}\n")

    def save_checkpoint(step, val_loss, tag):
        raw_model = model._orig_mod if hasattr(model, "_orig_mod") else model
        torch.save({
            "model"     : raw_model.state_dict(),
            "optimizer" : optimizer.state_dict(),
            "config"    : CONFIG,
            "meta"      : {"vocab_size": vocab_size, "block_size": block_size},
            "iter"      : step,
            "val_loss"  : val_loss,
        }, os.path.join(checkpoint_dir, f"model_pretrain_{tag}.pt"))

    t0 = time.time()
    step = start_iter
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
            val_loss = estimate_loss(model, val_loader, device, use_fp16, n_val_batches)
            elapsed = time.time() - t0
            print(f"step {step:6d}/{CONFIG['max_iters']} | "
                  f"train: {loss.item()*CONFIG['accumulation_steps']:.4f} | "
                  f"val: {val_loss:.4f} | lr: {lr:.2e} | elapsed: {elapsed:.1f}s")

            if val_loss < best_val_loss:
                best_val_loss, no_improve_evals = val_loss, 0
                save_checkpoint(step, best_val_loss, "best")
                print(f"  new best (val={best_val_loss:.4f}) -> model_pretrain_best.pt")
            else:
                no_improve_evals += 1
                if no_improve_evals >= CONFIG["patience"]:
                    print(f"\nEarly stopping: no improvement for {CONFIG['patience']} evals.")
                    break

        if step % CONFIG["save_every"] == 0 and step > 0:
            save_checkpoint(step, best_val_loss, "resume")

    save_checkpoint(step, best_val_loss, "resume")

    best_path = os.path.join(checkpoint_dir, "model_pretrain_best.pt")
    final_path = os.path.join(checkpoint_dir, "model_pretrained.pt")
    if os.path.exists(best_path):
        import shutil
        shutil.copyfile(best_path, final_path)

    print(f"\nPretraining complete. Best val loss: {best_val_loss:.4f}")
    print(f"Saved -> {final_path}")
    print("Next: python prepare_data.py --dataset dolly --reuse_tokenizer")
    print("Then: python train.py --init_from checkpoints/model_pretrained.pt")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stage 1: raw-text pretraining")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--checkpoint_dir", default="checkpoints")
    args = parser.parse_args()
    pretrain(checkpoint_dir=args.checkpoint_dir, resume=args.resume)
