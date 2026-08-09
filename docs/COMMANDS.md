# Mini LLM — Commands

One project, two independent folders:

```
MiniLLM/
├── docs/COMMANDS.md      ← you are here
├── training/              ← trains the model (needs a GPU, lots of deps)
│   └── checkpoints/       ← trained files land here automatically
└── server/                ← serves the trained model over an OpenAI-compatible API
    └── app/
```

**You never copy files between them.** `server/` automatically looks in
`../training/checkpoints` (relative to its own location, not wherever you
run the command from) — train in `training/`, then just start the server
in `server/` and it finds the model on its own. Only override
`--checkpoint_dir` if you move things around from this layout.

---

## Part 1 — Train the model

Run these from inside `training/`.

### Setup
```
pip install -r requirements.txt
```
Installs everything needed for training.

### Stage 1 — teach it language
```
python prepare_pretrain_data.py --dataset tinystories
```
Downloads story data and gets it ready.

```
python pretrain.py
```
Trains the model on stories. Takes a while. Saves progress as it goes.

```
python pretrain.py --resume
```
If it got interrupted, use this to continue instead of starting over.

### Stage 2 — teach it to follow instructions
```
python prepare_data.py --dataset dolly --reuse_tokenizer --block_size 511
```
Downloads the instruction data (Dolly-15k) and gets it ready.

```
python train.py --init_from checkpoints/model_pretrained.pt
```
Trains it to answer questions, starting from what it learned in Stage 1.

```
python train.py --resume
```
Continue Stage 2 if interrupted.

### Talk to it (from the command line)
```
python chat.py
```
Opens a chat window in your terminal.

```
python chat.py --prompt "Why is the sky blue?"
```
Ask one question and get one answer, no chat window.

### Shrink it (optional, for running without a GPU)
```
python quantize.py
```
Makes a smaller version of the model (4-bit). Use this one normally.

```
python quantize.py --bits 8
```
Slightly bigger file, but runs faster on a CPU.

```
python quantize.py --bits 2
```
Smallest file, but noticeably worse answers. Only for testing.

```
python chat.py --quantized --bits 4
```
Chat using the shrunk model (match the number to whatever you used above).

### Skip Stage 1 entirely (old, simpler way)
```
python prepare_data.py --dataset dolly
python train.py
python chat.py
```
Trains only on instructions, no story stage first. Faster, but answers are less fluent.

### Bring your own data
```
python prepare_data.py --data my_instructions.jsonl
python prepare_pretrain_data.py --data my_text.txt
```
Use a local file instead of downloading. Same instruction/context/response
JSONL format as Dolly, or any raw `.txt` for the story stage.

### Files in `training/`

| File | What it does |
|---|---|
| `prepare_pretrain_data.py` | Downloads + preps Stage 1 story data (TinyStories) |
| `pretrain.py` | Trains on stories, teaches basic language |
| `prepare_data.py` | Downloads + preps Stage 2 instruction data (Dolly-15k) |
| `train.py` | Trains on instructions, teaches Q&A |
| `model.py` | The model itself |
| `chat.py` | Talk to the trained model from the terminal |
| `quantize.py` | Shrinks the model (4-bit default) |
| `quant_utils.py` | Code that does the shrinking |
| `checkpoints/` | Trained models land here |

---

## Part 2 — Run the API server

Run these from inside `server/`. This folder is standalone — it doesn't
need `datasets`, TinyStories, or anything training-related, just enough to
load a checkpoint and serve it.

### Setup
```
uv sync
```
Creates a `.venv` here and installs everything needed to *run* the model
(torch, tokenizers, fastapi, uvicorn) — nothing training-related.

### Start the server
```
uv run python -m app.server
```
Loads the full-precision model from `../training/checkpoints` automatically
and starts serving on `http://localhost:8000`.

```
uv run python -m app.server --quantized --bits 4
```
Serve the quantized CPU model instead (must have run `quantize.py` in
`training/` first).

```
uv run python -m app.server --port 9000
```
Use a different port.

```
uv run python -m app.server --checkpoint_dir /some/other/path
```
Only needed if you've moved the checkpoints somewhere other than
`../training/checkpoints`.

### Talk to it over the API
```
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "mini-llm", "messages": [{"role": "user", "content": "Why is the sky blue?"}]}'
```

Or with the OpenAI Python SDK (works because the server speaks the same
`/v1/...` shape as OpenAI's API):
```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8000/v1", api_key="not-needed")

resp = client.chat.completions.create(
    model="mini-llm",
    messages=[{"role": "user", "content": "Why is the sky blue?"}],
    stream=True,
)
for chunk in resp:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

### Endpoints

| Endpoint | Does |
|---|---|
| `GET /v1/models` | Lists the one model this server serves |
| `POST /v1/chat/completions` | Chat-style request/response, `stream: true` supported |
| `POST /v1/completions` | Plain prompt-in/text-out, `stream: true` supported |
| `GET /health` | Returns `{"status": "ok"}` once the model's loaded |

### Files in `server/`

| File | What it does |
|---|---|
| `app/server.py` | The FastAPI app — the OpenAI-compatible endpoints |
| `app/inference.py` | Loads the model/tokenizer, runs generation (incl. streaming) |
| `app/model.py` | Same model class as `training/model.py` (copied, not shared — see Notes) |
| `app/quant_utils.py` | Same as `training/quant_utils.py` — needed to load INT4/INT2 checkpoints |
| `pyproject.toml` | `uv`-managed dependencies, inference-only |

### Important limitation — single-turn, not real multi-turn chat

The model was fine-tuned on single instruction → single response pairs,
not on multi-turn conversations. `/v1/chat/completions` accepts a full
`messages` array for compatibility with chat clients, but internally only
uses the most recent `system` message (as context) and the most recent
`user` message (as the instruction) — earlier turns are accepted but
ignored. The model has no real memory of prior turns in the conversation.

---

## Notes

- Training needs a GPU for a reasonable runtime (built with a free Google
  Colab T4 in mind). The server can run on CPU, especially with
  `--quantized`.
- `model.py` and `quant_utils.py` are duplicated between `training/` and
  `server/app/` on purpose — `server/` is meant to be copyable to a
  different machine (e.g. your PC) without dragging the whole training
  project's dependencies along. If you change the model architecture in
  `training/model.py`, copy the updated file into `server/app/model.py`
  too, or the server won't be able to load checkpoints trained with the
  new architecture.
- Answers won't be very factual — the model only knows what's in its
  training data, nowhere near a real large-scale LLM's.
