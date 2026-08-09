# Notes

Things worth knowing that don't belong to just training or just serving.

## Hardware

Training needs a GPU for a reasonable runtime (built with a free Google
Colab T4 in mind). The server can run on CPU, especially with
`--quantized` — see [SERVER.md](SERVER.md).

## Why `model.py` is duplicated

`training/model.py` and `server/app/model.py` are the same code, copied
rather than shared via import. That's on purpose: `server/` is meant to be
copyable to a different machine (e.g. your PC) without dragging the whole
training project's dependencies along with it. The same is true of
`quant_utils.py`.

**The trade-off:** if you ever change the model architecture in
`training/model.py`, copy the updated file into `server/app/model.py` too
— otherwise the server won't be able to load checkpoints trained with the
new architecture.

## Answer quality

Answers won't be very factual — the model only knows what's in its
training data (TinyStories + Dolly-15k by default), nowhere near a real
large-scale LLM's training data.
