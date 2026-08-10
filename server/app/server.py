"""
server.py — OpenAI-compatible local API server for the trained Mini LLM.

Run:
    uv run uvicorn app.server:app --host 0.0.0.0 --port 8000
    # or, with options:
    uv run python -m app.server --quantized --bits 4 --port 8000

"""

import argparse
import os
import time
import uuid

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.inference import load_tokenizer, load_model, generate, stream_generate

MODEL_ID = "mini-llm"

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_CHECKPOINT_DIR = os.path.normpath(
    os.path.join(_THIS_DIR, "..", "..", "training", "checkpoints")
)

app = FastAPI(title="Mini LLM (OpenAI-compatible)")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

STATE = {"model": None, "tokenizer": None, "meta": None, "device": "cpu"}


def load_runtime(checkpoint_dir=_DEFAULT_CHECKPOINT_DIR, quantized=False, bits=4):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    STATE["tokenizer"] = load_tokenizer(checkpoint_dir)
    model, meta, device = load_model(checkpoint_dir, device, quantized=quantized, bits=bits)
    STATE["model"] = model
    STATE["meta"] = meta
    STATE["device"] = device


def extract_instruction_and_context(messages):
    instruction, context = None, ""
    for m in messages:
        if m.role == "system":
            context = m.content
        elif m.role == "user":
            instruction = m.content
    if instruction is None:
        raise HTTPException(400, "messages must include at least one 'user' message")
    return instruction, context


# ── OpenAI-compatible schemas ────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = MODEL_ID
    messages: list[Message]
    temperature: float = 0.8
    top_p: float = 0.9
    max_tokens: int = 200
    stream: bool = False
    frequency_penalty: float = 0.0


class CompletionRequest(BaseModel):
    model: str = MODEL_ID
    prompt: str
    temperature: float = 0.8
    top_p: float = 0.9
    max_tokens: int = 200
    stream: bool = False
    frequency_penalty: float = 0.0


# ── Routes ────────────────────────────────────────────────────────────────

@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [{
            "id": MODEL_ID,
            "object": "model",
            "created": 0,
            "owned_by": "local",
        }],
    }


@app.get("/health")
def health():
    if STATE["model"] is None:
        raise HTTPException(503, "model not loaded")
    return {"status": "ok"}


def _rep_penalty(freq_penalty: float) -> float:
    # This model's generate() takes a multiplicative repetition_penalty
    # (>1.0 = less repetition), not OpenAI's additive frequency_penalty.
    return 1.0 + max(freq_penalty, 0.0)


@app.post("/v1/chat/completions")
def chat_completions(req: ChatCompletionRequest):
    if STATE["model"] is None:
        raise HTTPException(503, "model not loaded")
    instruction, context = extract_instruction_and_context(req.messages)
    rep_penalty = _rep_penalty(req.frequency_penalty)

    if req.stream:
        return StreamingResponse(
            _sse_chat_stream(instruction, context, req, rep_penalty),
            media_type="text/event-stream",
        )

    text, prompt_tokens, completion_tokens = generate(
        STATE["model"], STATE["tokenizer"], STATE["meta"], instruction, context,
        max_new_tokens=req.max_tokens, temperature=req.temperature,
        top_p=req.top_p, repetition_penalty=rep_penalty, device=STATE["device"],
    )
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": MODEL_ID,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": text},
            "finish_reason": "stop",
        }],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


def _sse_chat_stream(instruction, context, req, rep_penalty):
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())

    def chunk(delta, finish_reason=None):
        payload = {
            "id": completion_id, "object": "chat.completion.chunk", "created": created,
            "model": MODEL_ID,
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
        }
        return f"data: {__import__('json').dumps(payload)}\n\n"

    yield chunk({"role": "assistant", "content": ""})
    for piece in stream_generate(
        STATE["model"], STATE["tokenizer"], STATE["meta"], instruction, context,
        max_new_tokens=req.max_tokens, temperature=req.temperature,
        top_p=req.top_p, repetition_penalty=rep_penalty, device=STATE["device"],
    ):
        yield chunk({"content": piece})
    yield chunk({}, finish_reason="stop")
    yield "data: [DONE]\n\n"


@app.post("/v1/completions")
def completions(req: CompletionRequest):
    if STATE["model"] is None:
        raise HTTPException(503, "model not loaded")
    rep_penalty = _rep_penalty(req.frequency_penalty)

    if req.stream:
        return StreamingResponse(
            _sse_completion_stream(req, rep_penalty), media_type="text/event-stream",
        )

    text, prompt_tokens, completion_tokens = generate(
        STATE["model"], STATE["tokenizer"], STATE["meta"], req.prompt, "",
        max_new_tokens=req.max_tokens, temperature=req.temperature,
        top_p=req.top_p, repetition_penalty=rep_penalty, device=STATE["device"],
    )
    return {
        "id": f"cmpl-{uuid.uuid4().hex[:24]}",
        "object": "text_completion",
        "created": int(time.time()),
        "model": MODEL_ID,
        "choices": [{"index": 0, "text": text, "finish_reason": "stop"}],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


def _sse_completion_stream(req, rep_penalty):
    completion_id = f"cmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())

    def chunk(text, finish_reason=None):
        payload = {
            "id": completion_id, "object": "text_completion", "created": created,
            "model": MODEL_ID,
            "choices": [{"index": 0, "text": text, "finish_reason": finish_reason}],
        }
        return f"data: {__import__('json').dumps(payload)}\n\n"

    for piece in stream_generate(
        STATE["model"], STATE["tokenizer"], STATE["meta"], req.prompt, "",
        max_new_tokens=req.max_tokens, temperature=req.temperature,
        top_p=req.top_p, repetition_penalty=rep_penalty, device=STATE["device"],
    ):
        yield chunk(piece)
    yield chunk("", finish_reason="stop")
    yield "data: [DONE]\n\n"


if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint_dir", default=_DEFAULT_CHECKPOINT_DIR,
                         help=f"Default: {_DEFAULT_CHECKPOINT_DIR} "
                              f"(the training project's checkpoints/ folder, "
                              f"found automatically as long as training/ and "
                              f"server/ stay side by side).")
    parser.add_argument("--quantized", action="store_true")
    parser.add_argument("--bits", type=int, choices=(2, 4, 8), default=4)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    load_runtime(args.checkpoint_dir, quantized=args.quantized, bits=args.bits)
    uvicorn.run(app, host=args.host, port=args.port)
else:
    load_runtime(
        checkpoint_dir=os.environ.get("MINILLM_CHECKPOINT_DIR", _DEFAULT_CHECKPOINT_DIR),
        quantized=os.environ.get("MINILLM_QUANTIZED", "") == "1",
        bits=int(os.environ.get("MINILLM_BITS", "4")),
    )
