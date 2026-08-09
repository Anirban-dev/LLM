# Serving the Mini-LLM (OpenAI-Compatible API & Streamlit UI)

Run every command below from inside the `server/` folder. This directory is standalone — it doesn't need `datasets`, TinyStories, or training logic, just enough to load model checkpoints and serve them via an OpenAI-compatible FastAPI backend and a Streamlit frontend.

---

## Directory Structure

```text
TRAINING.md
├── server/
│   ├── .venv/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── inference.py
│   │   ├── model.py
│   │   ├── quant_utils.py
│   │   └── server.py
│   ├── streamlit_app.py   <-- Streamlit Web UI
│   ├── pyproject.toml     <-- Dependencies (FastAPI, Streamlit, etc.)
│   └── uv.lock
├── training/
└── README.md
```

---

## Setup & Dependencies

Install all required dependencies using `uv`:

```bash
cd server
uv sync
```

This creates a local `.venv` and installs everything required for model inference and the web UI:
- `torch`, `tokenizers`, `fastapi`, `uvicorn`, `pydantic`
- `streamlit`, `requests`

---

## Running the Application

To run the complete system, you will use **two separate terminal windows**.

### Step 1: Start the API Server (Terminal 1)

Standard full-precision model server (runs on `http://localhost:8000`):

```bash
uv run python -m app.server
```

#### Server Options & Flags:

- **Quantized CPU Inference (4-bit / 2-bit):**
  ```bash
  uv run python -m app.server --quantized --bits 4
  ```
  *(Requires running `quantize.py` inside `training/` beforehand).*

- **Custom Port:**
  ```bash
  uv run python -m app.server --port 9000
  ```

- **Custom Checkpoint Path:**
  ```bash
  uv run python -m app.server --checkpoint_dir ../training/checkpoints
  ```

---

### Step 2: Start the Streamlit Web UI (Terminal 2)

In a new terminal window, navigate to `server/` and start the Streamlit app:

```bash
uv run streamlit run streamlit_app.py
```

This launches the web interface at `http://localhost:8501`, featuring:
- **Streaming Mode:** Real-time token streaming using Server-Sent Events (SSE).
- **Non-Streaming Mode:** Single-shot complete response fetching.
- **Configurable Endpoint & Model Name:** Options to adjust host, port, or target model name in the sidebar.

---
## Direct API Usage (CLI / SDK)

Since the server uses OpenAI-compatible schemas, you can query it via `curl` or the `openai` Python SDK.

### cURL Example

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
        "model": "mini-llm",
        "messages": [{"role": "user", "content": "Why is the sky blue?"}],
        "stream": false
      }'
```

### OpenAI Python SDK Example

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

---

## API Endpoints Summary

| Endpoint | Method | Description |
|---|---|---|
| `/v1/models` | `GET` | Lists available models served by this server instance. |
| `/v1/chat/completions` | `POST` | Chat-style completions (`stream: true/false` supported). |
| `/v1/completions` | `POST` | Plain text completion (`stream: true/false` supported). |
| `/health` | `GET` | Health check returning `{"status": "ok"}` once loaded. |

---

## Server Directory File Breakdown

| File | Function |
|---|---|
| `streamlit_app.py` | Web UI supporting streaming and non-streaming model responses |
| `app/server.py` | FastAPI application providing OpenAI-compatible API routes |
| `app/inference.py` | Inference engine handling generation & token streaming |
| `app/model.py` | Transformer architecture definition |
| `app/quant_utils.py` | Utilities for loading quantized checkpoints (INT4/INT2) |
| `pyproject.toml` | `uv` project definition and dependencies |

---

## Important Limitation: Single-Turn Memory

The model was fine-tuned on single instruction-response pairs rather than multi-turn conversations. `/v1/chat/completions` accepts a full `messages` array for software client compatibility, but internally uses only:
- The **most recent `system` message** (as prompt context).
- The **most recent `user` message** (as the instruction).

Earlier message turns in the array are ignored.