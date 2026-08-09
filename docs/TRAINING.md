# Training

Run every command below from inside `training/`. See [README.md](README.md)
for how this folder relates to `server/`.

## Setup

```bash
pip install -r requirements.txt
```
Installs everything needed for training.

## Stage 1 — teach it language

```bash
python prepare_pretrain_data.py --dataset tinystories
```
Downloads story data and gets it ready.

```bash
python pretrain.py
```
Trains the model on stories. Takes a while. Saves progress as it goes.

```bash
python pretrain.py --resume
```
If it got interrupted, use this to continue instead of starting over.

## Stage 2 — teach it to follow instructions

```bash
python prepare_data.py --dataset dolly --reuse_tokenizer --block_size 511
```
Downloads the instruction data (Dolly-15k) and gets it ready.

```bash
python train.py --init_from checkpoints/model_pretrained.pt
```
Trains it to answer questions, starting from what it learned in Stage 1.

```bash
python train.py --resume
```
Continue Stage 2 if interrupted.

## Talk to it (from the command line)

```bash
python chat.py
```
Opens a chat window in your terminal.

```bash
python chat.py --prompt "Why is the sky blue?"
```
Ask one question and get one answer, no chat window.

## Shrink it (optional, for running without a GPU)

```bash
python quantize.py
```
Makes a smaller version of the model (4-bit). Use this one normally.

```bash
python quantize.py --bits 8
```
Slightly bigger file, but runs faster on a CPU.

```bash
python quantize.py --bits 2
```
Smallest file, but noticeably worse answers. Only for testing.

```bash
python chat.py --quantized --bits 4
```
Chat using the shrunk model (match the number to whatever you used above).

## Skip Stage 1 entirely (old, simpler way)

```bash
python prepare_data.py --dataset dolly
python train.py
python chat.py
```
Trains only on instructions, no story stage first. Faster, but answers are less fluent.

## Bring your own data

```bash
python prepare_data.py --data my_instructions.jsonl
python prepare_pretrain_data.py --data my_text.txt
```
Use a local file instead of downloading. Same instruction/context/response
JSONL format as Dolly, or any raw `.txt` for the story stage.

## Files in `training/`

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

Once you have a trained model here, head to [SERVER.md](SERVER.md) to serve it.
