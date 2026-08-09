# Mini LLM — Docs

One project, two independent folders:

```
MiniLLM/
├── docs/                  ← you are here
├── training/               ← trains the model (needs a GPU, lots of deps)
│   └── checkpoints/        ← trained files land here automatically
└── server/                 ← serves the trained model over an OpenAI-compatible API
    └── app/
```

## Where to go

| Doc | Read this if you want to... |
|---|---|
| [TRAINING.md](TRAINING.md) | Train the model from scratch, resume an interrupted run, chat with it from the terminal, or shrink it with quantization |
| [SERVER.md](SERVER.md) | Serve an already-trained model over an OpenAI-compatible API |
| [NOTES.md](NOTES.md) | Hardware requirements, project quirks, and honest limitations |

## The short version

**You never copy files between `training/` and `server/`.** `server/`
automatically looks in `../training/checkpoints` (relative to its own
location, not wherever you run the command from) — train in `training/`,
then just start the server in `server/` and it finds the model on its own.

```bash
cd training
# ...train the model — see TRAINING.md...

cd ../server
uv sync
uv run python -m app.server
# ...it's now live at http://localhost:8000 — see SERVER.md...
# this is the whole startup process — no other script needs to be running
```
