"""
prepare_data.py — Stage 2 data prep (run before train.py)

    python prepare_data.py --dataset dolly
    python prepare_data.py --dataset dolly --reuse_tokenizer   # after Stage 1

Trains a tokenizer, builds instruction/response prompts, masks loss to
response tokens only (don't waste gradient on memorizing prompts).

Output (in checkpoints/): tokenizer.json, train_data.pt, val_data.pt
"""

import argparse
import json
import os
import random

import torch
from tokenizers import ByteLevelBPETokenizer

PAD_TOKEN = "<|pad|>"
EOS_TOKEN = "<|endoftext|>"


def load_dolly_records(path):
    """Reads a Dolly-format JSONL file: {instruction, context, response, category}."""
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            records.append({
                "instruction": obj.get("instruction", "").strip(),
                "context":     obj.get("context", "").strip(),
                "response":    obj.get("response", "").strip(),
            })
    return records


def download_dolly_records():
    """Downloads Dolly-15k straight from Hugging Face — no local file needed."""
    try:
        from datasets import load_dataset
    except ImportError:
        raise SystemExit(
            "Downloading Dolly-15k needs the `datasets` package.\n"
            "  pip install datasets\n"
            "Or use --data <path/to/your.jsonl> to skip the download."
        )
    print("Downloading Dolly-15k (databricks/databricks-dolly-15k, train split)...")
    ds = load_dataset("databricks/databricks-dolly-15k", split="train")
    return [{
        "instruction": row["instruction"].strip(),
        "context":     row.get("context", "").strip(),
        "response":    row["response"].strip(),
    } for row in ds]


def download_alpaca_records():
    """Downloads Stanford Alpaca (~52k examples) from Hugging Face. Combine
    with --dataset dolly+alpaca+slimorca to give a bigger model (e.g. the
    300M config) more Stage 2 examples than Dolly alone (~15k) provides —
    more capacity without more data just means faster memorization, not
    better instruction-following."""
    try:
        from datasets import load_dataset
    except ImportError:
        raise SystemExit(
            "Downloading Alpaca needs the `datasets` package.\n"
            "  pip install datasets\n"
            "Or use --data <path/to/your.jsonl> to skip the download."
        )
    print("Downloading Alpaca (tatsu-lab/alpaca, train split)...")
    ds = load_dataset("tatsu-lab/alpaca", split="train")
    return [{
        "instruction": row["instruction"].strip(),
        "context":     row.get("input", "").strip(),
        "response":    row["output"].strip(),
    } for row in ds]


def download_slimorca_records():
    """Downloads SlimOrca (~518k examples) from Hugging Face — cleaned,
    GPT-4-generated instruction/response pairs. This is the big jump in
    Stage 2 data volume: combined with Dolly+Alpaca it takes Stage 2 from
    ~67k examples to ~585k, which is what actually justifies fine-tuning a
    ~286M param model instead of just letting it memorize a small set faster.
    Each record is a {"from": "system"/"human"/"gpt", "value": ...} list;
    the system turn (if present) becomes context, human becomes the
    instruction, gpt becomes the response."""
    try:
        from datasets import load_dataset
    except ImportError:
        raise SystemExit(
            "Downloading SlimOrca needs the `datasets` package.\n"
            "  pip install datasets\n"
            "Or use --data <path/to/your.jsonl> to skip the download."
        )
    print("Downloading SlimOrca (Open-Orca/SlimOrca, train split)...")
    ds = load_dataset("Open-Orca/SlimOrca", split="train")
    records = []
    for row in ds:
        system_msg, human_msg, gpt_msg = "", "", ""
        for turn in row.get("conversations", []):
            role = turn.get("from", "")
            val  = turn.get("value", "").strip()
            if role == "system":
                system_msg = val
            elif role == "human":
                human_msg = val
            elif role == "gpt":
                gpt_msg = val
        if not human_msg or not gpt_msg:
            continue  # skip malformed/incomplete conversations
        records.append({
            "instruction": human_msg,
            "context":     system_msg,
            "response":    gpt_msg,
        })
    return records


def build_prompt(instruction, context):
    if context:
        return (f"### Instruction:\n{instruction}\n\n"
                f"### Context:\n{context}\n\n"
                f"### Response:\n")
    return f"### Instruction:\n{instruction}\n\n### Response:\n"


def train_tokenizer(records, vocab_size, out_path):
    print(f"Training byte-level BPE tokenizer (vocab_size={vocab_size})...")
    # Write a temp corpus file of prompt+response text for the tokenizer trainer
    tmp_path = out_path + ".corpus.tmp.txt"
    with open(tmp_path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(build_prompt(r["instruction"], r["context"]))
            f.write(r["response"])
            f.write("\n")

    tokenizer = ByteLevelBPETokenizer()
    tokenizer.train(
        files=[tmp_path],
        vocab_size=vocab_size,
        min_frequency=2,
        special_tokens=[PAD_TOKEN, EOS_TOKEN],
    )
    os.remove(tmp_path)
    tokenizer.save(out_path)
    print(f"Tokenizer saved -> {out_path}  (actual vocab size: {tokenizer.get_vocab_size()})")
    return tokenizer


def pack_example(tokenizer, record, block_size, eos_id):
    prompt_ids = tokenizer.encode(build_prompt(record["instruction"], record["context"])).ids
    response_ids = tokenizer.encode(record["response"]).ids + [eos_id]

    # Standard causal-LM shift: model(x)'s logits at position i predict the
    # token at position i+1 — mirrors pretrain.py's `block[:-1], block[1:]`
    # scheme. `full` first, `aligned_labels` marks which positions in `full`
    # are real loss targets (response tokens) vs masked prompt tokens, at
    # the SAME index as `full`. Then we shift by one to build the actual
    # (input, target) pair: input drops the last token (nothing to predict
    # after it), target drops the first (nothing predicts the first token).
    full = prompt_ids + response_ids
    aligned_labels = [-100] * len(prompt_ids) + response_ids  # same length/index as `full`

    ids    = full[:-1]
    labels = aligned_labels[1:]

    if len(ids) > block_size:
        # Truncate from the FRONT so we always keep the full response
        # (that's the part we actually train the loss on).
        overflow = len(ids) - block_size
        ids, labels = ids[overflow:], labels[overflow:]

    if len(labels) == len([l for l in labels if l == -100]):
        return None  # response got fully truncated away, skip this example

    return torch.tensor(ids, dtype=torch.long), torch.tensor(labels, dtype=torch.long)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=None, help="Path to a local Dolly-format .jsonl file "
                     "instead of downloading (any instruction/context/response JSONL works).")
    ap.add_argument("--dataset",
                     choices=["dolly", "alpaca", "slimorca",
                              "dolly+alpaca", "dolly+alpaca+slimorca"],
                     default=None,
                     help="Built-in instruction dataset(s) to download. "
                          "'dolly+alpaca+slimorca' (~585k examples total) is "
                          "the default — sized for the 300M model config, "
                          "since Dolly alone (~14k train examples) is too "
                          "little data for a model that size to learn from "
                          "without memorizing.")
    ap.add_argument("--vocab_size", type=int, default=8000)
    ap.add_argument("--block_size", type=int, default=512)
    ap.add_argument("--val_fraction", type=float, default=0.05)
    ap.add_argument("--checkpoint_dir", default="checkpoints")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--reuse_tokenizer", action="store_true",
                     help="If checkpoints/tokenizer.json already exists (e.g. from "
                          "prepare_pretrain_data.py), load it instead of training a "
                          "new one. Required if you plan to --init_from a pretrained "
                          "checkpoint in train.py, since the two stages must share a "
                          "vocabulary.")
    args = ap.parse_args()

    if not args.dataset and not args.data:
        args.dataset = "dolly"
        print("No --dataset or --data given, defaulting to --dataset dolly.")

    os.makedirs(args.checkpoint_dir, exist_ok=True)
    tok_path = os.path.join(args.checkpoint_dir, "tokenizer.json")

    if args.data:
        print(f"Reading '{args.data}'...")
        records = load_dolly_records(args.data)
    elif args.dataset == "alpaca":
        records = download_alpaca_records()
    elif args.dataset == "slimorca":
        records = download_slimorca_records()
    elif args.dataset == "dolly+alpaca":
        records = download_dolly_records() + download_alpaca_records()
    elif args.dataset == "dolly+alpaca+slimorca":
        records = (download_dolly_records() + download_alpaca_records()
                   + download_slimorca_records())
    else:
        records = download_dolly_records()
    print(f"Loaded {len(records):,} instruction/response records.")

    if args.reuse_tokenizer:
        if not os.path.exists(tok_path):
            raise FileNotFoundError(
                f"--reuse_tokenizer given but no tokenizer found at {tok_path}. "
                "Run prepare_pretrain_data.py first, or drop --reuse_tokenizer to "
                "train a fresh Dolly-only tokenizer."
            )
        from tokenizers import Tokenizer
        print(f"Reusing existing tokenizer -> {tok_path}")
        tokenizer = Tokenizer.from_file(tok_path)
    else:
        tokenizer = train_tokenizer(records, args.vocab_size, tok_path)
    eos_id = tokenizer.token_to_id(EOS_TOKEN)

    random.seed(args.seed)
    random.shuffle(records)
    n_val = max(1, int(len(records) * args.val_fraction))
    val_records, train_records = records[:n_val], records[n_val:]

    def pack_all(recs, name):
        examples = []
        skipped = 0
        for r in recs:
            packed = pack_example(tokenizer, r, args.block_size, eos_id)
            if packed is None:
                skipped += 1
                continue
            examples.append(packed)
        avg_len = sum(len(x[0]) for x in examples) / max(1, len(examples))
        print(f"{name}: {len(examples):,} examples packed "
              f"(avg {avg_len:.0f} tokens, {skipped} skipped as too-long)")
        return examples

    train_examples = pack_all(train_records, "train")
    val_examples   = pack_all(val_records, "val")

    torch.save(train_examples, os.path.join(args.checkpoint_dir, "train_data.pt"))
    torch.save(val_examples,   os.path.join(args.checkpoint_dir, "val_data.pt"))

    meta = {
        "vocab_size": tokenizer.get_vocab_size(),
        "block_size": args.block_size,
        "pad_id":     tokenizer.token_to_id(PAD_TOKEN),
        "eos_id":     eos_id,
    }
    with open(os.path.join(args.checkpoint_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nDone. {meta}")
    print("Run:  python train.py")


if __name__ == "__main__":
    main()
