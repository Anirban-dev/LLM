# Serving the model (OpenAI-compatible API)

Run every command below from inside `server/`. This folder is standalone —
it doesn't need `datasets`, TinyStories, or anything training-related,
just enough to load a checkpoint and serve it. See [README.md](README.md)
for how this folder relates to `training/`.

## Setup

```bash
uv sync
```
Creates a `.venv` here and installs everything needed to *run* the model
(torch, tokenizers, fastapi, uvicorn) — nothing training-related.

**This is the only thing you run.** `chat.py` (in `training/`) is a
separate, terminal-only way to talk to the model — the server doesn't
call it, launch it, or need it running. Starting the server below is the
entire startup process; nothing else needs to be running alongside it.

## Start the server

```bash
uv run python -m app.server
```
Loads the full-precision model from `../training/checkpoints` automatically
and starts serving on `http://localhost:8000`.

```bash
uv run python -m app.server --quantized --bits 4
```
Serve the quantized CPU model instead (must have run `quantize.py` in
`training/` first — see [TRAINING.md](TRAINING.md)).

```bash
uv run python -m app.server --port 9000
```
Use a different port.

```bash
uv run python -m app.server --checkpoint_dir /some/other/path
```
Only needed if you've moved the checkpoints somewhere other than
`../training/checkpoints`.

## Talk to it over the API

```bash
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

## Endpoints

| Endpoint | Does |
|---|---|
| `GET /v1/models` | Lists the one model this server serves |
| `POST /v1/chat/completions` | Chat-style request/response, `stream: true` supported |
| `POST /v1/completions` | Plain prompt-in/text-out, `stream: true` supported |
| `GET /health` | Returns `{"status": "ok"}` once the model's loaded |

## Files in `server/`

| File | What it does |
|---|---|
| `app/server.py` | The FastAPI app — the OpenAI-compatible endpoints |
| `app/inference.py` | Loads the model/tokenizer, runs generation (incl. streaming) |
| `app/model.py` | Same model class as `training/model.py` (copied, not shared — see [NOTES.md](NOTES.md)) |
| `app/quant_utils.py` | Same as `training/quant_utils.py` — needed to load INT4/INT2 checkpoints |
| `pyproject.toml` | `uv`-managed dependencies, inference-only |

## Important limitation — single-turn, not real multi-turn chat

The model was fine-tuned on single instruction → single response pairs,
not on multi-turn conversations. `/v1/chat/completions` accepts a full
`messages` array for compatibility with chat clients, but internally only
uses the most recent `system` message (as context) and the most recent
`user` message (as the instruction) — earlier turns are accepted but
ignored. The model has no real memory of prior turns in the conversation.
