"""
prepare_pretrain_data.py — Stage 1 data prep (run before pretrain.py)

    python prepare_pretrain_data.py --dataset tinystories

Downloads TinyStories (simple synthetic stories, good for teaching a
small model basic language) and packs it into fixed-length blocks. Every
token trains here — no prompt/response split like Stage 2 has.

Output (in checkpoints/): tokenizer.json, pretrain_train_data.pt, pretrain_val_data.pt
"""

import argparse
import array
import os
import random

import torch
from tokenizers import ByteLevelBPETokenizer

PAD_TOKEN = "<|pad|>"
EOS_TOKEN = "<|endoftext|>"


def load_local_text(path):
    """Reads a local raw text file. Blank lines separate documents; an
    <|endoftext|> is inserted between documents so the model learns where
    one piece of text ends and an unrelated one begins."""
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    docs = [d.strip() for d in raw.split("\n\n") if d.strip()]
    if len(docs) <= 1:
        # No blank-line structure found — treat the whole file as one stream.
        docs = [raw.strip()]
    return docs


def load_tinystories(limit=None):
    """Downloads TinyStories (https://huggingface.co/datasets/roneneldan/TinyStories)
    via the `datasets` library. Requires internet access and the `datasets`
    package (pip install datasets). Kept as an option for quick/small runs —
    see load_fineweb() for the corpus actually sized for the 300M config."""
    try:
        from datasets import load_dataset
    except ImportError:
        raise SystemExit(
            "Loading TinyStories needs the `datasets` package.\n"
            "  pip install datasets\n"
            "Or use --data <path/to/your.txt> to skip the download entirely."
        )
    print("Downloading TinyStories (roneneldan/TinyStories, train split)...")
    ds = load_dataset("roneneldan/TinyStories", split="train")
    if limit is not None:
        ds = ds.select(range(min(limit, len(ds))))
    docs = [row["text"].strip() for row in ds if row["text"].strip()]
    return docs


def load_fineweb(token_budget):
    """Streams FineWeb-Edu (HuggingFaceFW/fineweb-edu, 'sample-10BT' config)
    and stops once roughly `token_budget` tokens' worth of text has been
    collected. This is real, general-domain (education-filtered) web text —
    unlike TinyStories, whose entire corpus is only ~470M tokens total, this
    can supply the several-billion-token budget a ~285M param model actually
    needs (Chinchilla rule of thumb: ~20 tokens/param -> ~6B tokens for this
    model). Streamed rather than downloaded whole, since the full 10BT split
    is far more than most --token_budget values need.

    Token count isn't known until after the tokenizer is trained (that
    happens later in main()), so this uses a rough chars-per-token estimate
    (~4, typical for byte-level BPE on English text) just to decide when to
    stop streaming. The real token count gets printed after tokenization."""
    try:
        from datasets import load_dataset
    except ImportError:
        raise SystemExit(
            "Loading FineWeb-Edu needs the `datasets` package.\n"
            "  pip install datasets\n"
            "Or use --data <path/to/your.txt> to skip the download entirely."
        )
    chars_per_token_estimate = 4
    char_budget = token_budget * chars_per_token_estimate
    print(f"Streaming FineWeb-Edu (HuggingFaceFW/fineweb-edu, sample-10BT) "
          f"until ~{token_budget/1e9:.1f}B tokens collected "
          f"(~{char_budget/1e9:.1f}B characters)...")
    ds = load_dataset("HuggingFaceFW/fineweb-edu", name="sample-10BT",
                       split="train", streaming=True)
    docs = []
    total_chars = 0
    for row in ds:
        text = row["text"].strip()
        if not text:
            continue
        docs.append(text)
        total_chars += len(text)
        if total_chars >= char_budget:
            break
    print(f"Collected {len(docs):,} documents "
          f"(~{total_chars/1e9:.2f}B characters, "
          f"~{total_chars/chars_per_token_estimate/1e9:.2f}B tokens estimated).")
    return docs


def train_tokenizer(docs, vocab_size, out_path):
    print(f"Training byte-level BPE tokenizer (vocab_size={vocab_size})...")
    tmp_path = out_path + ".corpus.tmp.txt"
    with open(tmp_path, "w", encoding="utf-8") as f:
        for d in docs:
            f.write(d)
            f.write(f"\n{EOS_TOKEN}\n")

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


def chunk_into_blocks(token_stream, block_size):
    """Splits one long token stream into non-overlapping block_size chunks.
    The last, shorter-than-block_size remainder is dropped — standard
    practice for LM pretraining, and it keeps every training example the
    same length (no padding needed at all in pretrain.py).

    token_stream is an array.array('I', ...), not a Python list — with
    ~200k TinyStories documents (~40M+ tokens) a plain list of boxed
    Python ints runs into the tens-of-GB range on RAM-constrained
    environments like a free Colab instance; array.array packs each id
    into 4 raw bytes instead, cutting that by roughly 7x."""
    n_full = len(token_stream) // block_size
    blocks = []
    for i in range(n_full):
        chunk = token_stream[i * block_size:(i + 1) * block_size]
        blocks.append(torch.frombuffer(chunk, dtype=torch.int32).long())
    return blocks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["tinystories", "fineweb"], default=None,
                     help="Built-in raw-text dataset to download. 'fineweb' "
                          "(FineWeb-Edu) is the default — sized for the "
                          "300M-param config's real token budget, unlike "
                          "TinyStories whose entire corpus is only ~470M "
                          "tokens total. Use --dataset tinystories for a "
                          "quick/small test run instead.")
    ap.add_argument("--data", default=None,
                     help="Path to a local raw .txt file instead of --dataset. "
                          "Blank lines separate documents.")
    ap.add_argument("--limit", type=int, default=400_000,
                     help="Only used with --dataset tinystories. Cap on "
                          "number of documents (TinyStories has ~2.1M docs, "
                          "~470M tokens total; 400k docs is ~80M+ tokens, "
                          "sized to match the 448/8/8 (~23M param) config "
                          "in pretrain.py's CONFIG).")
    ap.add_argument("--token_budget", type=int, default=6_000_000_000,
                     help="Only used with --dataset fineweb. Roughly how "
                          "many tokens to stream before stopping. Default "
                          "6B matches the Chinchilla-style ~20 tokens/param "
                          "rule of thumb for the ~286M param config in "
                          "pretrain.py's CONFIG. Lower this if a full run "
                          "won't fit your available Colab session time; "
                          "--resume in pretrain.py lets you continue a "
                          "training run across sessions either way (this "
                          "flag only controls how much data gets prepared, "
                          "once).")
    ap.add_argument("--vocab_size", type=int, default=8000)
    ap.add_argument("--block_size", type=int, default=512)
    ap.add_argument("--val_fraction", type=float, default=0.02)
    ap.add_argument("--checkpoint_dir", default="checkpoints")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    if not args.dataset and not args.data:
        args.dataset = "tinystories"
        print("No --dataset or --data given, defaulting to --dataset tinystories.")

    os.makedirs(args.checkpoint_dir, exist_ok=True)
    tok_path = os.path.join(args.checkpoint_dir, "tokenizer.json")

    if args.data:
        print(f"Reading local raw text from '{args.data}'...")
        docs = load_local_text(args.data)
    elif args.dataset == "fineweb":
        docs = load_fineweb(token_budget=args.token_budget)
    else:
        docs = load_tinystories(limit=args.limit)
    print(f"Loaded {len(docs):,} documents.")

    tokenizer = train_tokenizer(docs, args.vocab_size, tok_path)
    eos_id = tokenizer.token_to_id(EOS_TOKEN)

    random.seed(args.seed)
    random.shuffle(docs)
    n_val = max(1, int(len(docs) * args.val_fraction))
    val_docs, train_docs = docs[:n_val], docs[n_val:]

    def build_stream(doc_list):
        # array('I', ...) is a packed C array of unsigned ints (4 bytes each)
        # rather than a Python list of boxed int objects (28+ bytes each) —
        # for a multi-million-token stream that's the difference between a
        # few hundred MB and multiple GB of RAM.
        stream = array.array("I")
        for d in doc_list:
            stream.extend(tokenizer.encode(d).ids)
            stream.append(eos_id)
        return stream

    print("Tokenizing and packing into fixed-length blocks...")
    train_blocks = chunk_into_blocks(build_stream(train_docs), args.block_size)
    val_blocks   = chunk_into_blocks(build_stream(val_docs), args.block_size)

    total_tokens = (len(train_blocks) + len(val_blocks)) * args.block_size
    print(f"train: {len(train_blocks):,} blocks   val: {len(val_blocks):,} blocks   "
          f"(~{total_tokens/1e6:.1f}M tokens total, block_size={args.block_size})")

    torch.save(train_blocks, os.path.join(args.checkpoint_dir, "pretrain_train_data.pt"))
    torch.save(val_blocks,   os.path.join(args.checkpoint_dir, "pretrain_val_data.pt"))

    print("\nDone.")
    print("Run:  python pretrain.py")


if __name__ == "__main__":
    main()
