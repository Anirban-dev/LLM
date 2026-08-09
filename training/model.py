"""
model.py — the GPT model (MiniGPT)

Fused QKV attention, scaled_dot_product_attention, weight tying.
Trained in fp16; quantization happens separately in quantize.py.
"""

import math
import torch
import torch.nn as nn
from torch.nn import functional as F


# ──────────────────────────────────────────────
#  1. FUSED MULTI-HEAD SELF-ATTENTION
# ──────────────────────────────────────────────
class CausalSelfAttention(nn.Module):
    """
    One Linear projects to Q, K and V for ALL heads at once, then we just
    reshape. This is the standard nanoGPT-style trick: it replaces
    `n_heads` separate small matmuls with a single large one, which is
    what GPUs are good at — far fewer kernel launches, much better
    utilization than the v1 per-head loop.
    """

    def __init__(self, embed_dim, n_heads, dropout):
        super().__init__()
        assert embed_dim % n_heads == 0, "embed_dim must be divisible by n_heads"
        self.n_heads  = n_heads
        self.head_dim = embed_dim // n_heads
        self.dropout  = dropout

        self.qkv  = nn.Linear(embed_dim, 3 * embed_dim, bias=False)
        self.proj = nn.Linear(embed_dim, embed_dim)
        self.resid_dropout = nn.Dropout(dropout)

    def forward(self, x, past_kv=None, use_cache=False):
        B, T, C = x.shape
        qkv = self.qkv(x)                                   # (B, T, 3C)
        q, k, v = qkv.split(C, dim=2)
        q = q.view(B, T, self.n_heads, self.head_dim).transpose(1, 2)  # (B, nh, T, hd)
        k = k.view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        v = v.view(B, T, self.n_heads, self.head_dim).transpose(1, 2)

        if past_kv is not None:
            past_k, past_v = past_kv
            k = torch.cat([past_k, k], dim=2)
            v = torch.cat([past_v, v], dim=2)
        present = (k, v) if use_cache else None

        # Only mask when there's more than one *new* query position to hide
        # future tokens from each other (prompt processing / training). A
        # single incremental decode step (T==1) has nothing to hide — every
        # key in `k` (past + this token) is already at or before its own
        # position by construction — so skip the mask and let SDPA take the
        # faster unmasked path.
        is_causal = T > 1

        # SDPA picks the best available kernel (flash / mem-efficient / math)
        # for the current device automatically. is_causal=True means we don't
        # need to materialize or store a (T, T) mask buffer at all.
        out = F.scaled_dot_product_attention(
            q, k, v,
            dropout_p=self.dropout if self.training else 0.0,
            is_causal=is_causal,
        )
        out = out.transpose(1, 2).contiguous().view(B, T, C)
        return self.resid_dropout(self.proj(out)), present


# ──────────────────────────────────────────────
#  2. FEED-FORWARD NETWORK
# ──────────────────────────────────────────────
class FeedForward(nn.Module):
    def __init__(self, embed_dim, dropout):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(embed_dim, 4 * embed_dim),
            nn.GELU(),
            nn.Linear(4 * embed_dim, embed_dim),
            nn.Dropout(dropout),
        )

    def forward(self, x):
        return self.net(x)


# ──────────────────────────────────────────────
#  3. TRANSFORMER BLOCK
# ──────────────────────────────────────────────
class TransformerBlock(nn.Module):
    def __init__(self, embed_dim, n_heads, dropout):
        super().__init__()
        self.attn = CausalSelfAttention(embed_dim, n_heads, dropout)
        self.ff   = FeedForward(embed_dim, dropout)
        self.ln1  = nn.LayerNorm(embed_dim)
        self.ln2  = nn.LayerNorm(embed_dim)

    def forward(self, x, past_kv=None, use_cache=False):
        attn_out, present = self.attn(self.ln1(x), past_kv=past_kv, use_cache=use_cache)
        x = x + attn_out
        x = x + self.ff(self.ln2(x))
        return x, present


# ──────────────────────────────────────────────
#  4. MINI GPT
# ──────────────────────────────────────────────
class MiniGPT(nn.Module):
    def __init__(self, vocab_size, embed_dim, n_heads, n_layers,
                 block_size, dropout, grad_checkpoint=False):
        super().__init__()
        self.block_size      = block_size
        self.grad_checkpoint = grad_checkpoint

        self.token_emb    = nn.Embedding(vocab_size, embed_dim)
        self.position_emb = nn.Embedding(block_size, embed_dim)
        self.drop         = nn.Dropout(dropout)
        self.blocks       = nn.ModuleList([
            TransformerBlock(embed_dim, n_heads, dropout)
            for _ in range(n_layers)
        ])
        self.ln_final = nn.LayerNorm(embed_dim)
        self.lm_head  = nn.Linear(embed_dim, vocab_size, bias=False)

        # Weight tying — shares embedding and output weights (saves ~vocab*embed
        # params and generally improves small-model quality)
        self.lm_head.weight = self.token_emb.weight

        self.apply(self._init_weights)
        # GPT-2 style scaled init for residual projections — keeps deeper
        # models stable without needing extra warmup tricks
        for name, p in self.named_parameters():
            if name.endswith("proj.weight") or name.endswith("net.2.weight"):
                nn.init.normal_(p, mean=0.0, std=0.02 / math.sqrt(2 * n_layers))

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx, targets=None, past_kv=None, use_cache=False):
        B, T = idx.shape
        past_length = past_kv[0][0].shape[2] if past_kv is not None else 0
        assert past_length + T <= self.block_size, \
            f"Sequence too long ({past_length + T} > {self.block_size})"

        tok_emb = self.token_emb(idx)
        pos_ids = torch.arange(past_length, past_length + T, device=idx.device)
        pos_emb = self.position_emb(pos_ids)
        x       = self.drop(tok_emb + pos_emb)

        new_past_kv = [] if use_cache else None
        if self.grad_checkpoint and self.training:
            for block in self.blocks:
                x, _ = torch.utils.checkpoint.checkpoint(block, x, None, False, use_reentrant=False)
        else:
            for i, block in enumerate(self.blocks):
                layer_past = past_kv[i] if past_kv is not None else None
                x, present = block(x, past_kv=layer_past, use_cache=use_cache)
                if use_cache:
                    new_past_kv.append(present)

        x = self.ln_final(x)

        if targets is not None:
            logits = self.lm_head(x)
            # targets use -100 for positions we don't want a loss on
            # (the prompt tokens and padding) — this is what makes
            # instruction-tuning sample-efficient on a small dataset.
            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)), targets.view(-1),
                ignore_index=-100,
            )
        else:
            # inference: only need logits for the last position
            logits = self.lm_head(x[:, [-1], :])
            loss = None

        if use_cache:
            return logits, loss, new_past_kv
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None,
                 top_p=None, repetition_penalty=1.0, eos_token_id=None,
                 use_cache=True):
        """
        Autoregressive sampling.

        use_cache=True (default) uses KV-caching: the prompt is run through
        the model once, then each new token only requires a forward pass
        over that ONE new token (attending to cached keys/values from every
        previous step) instead of recomputing attention over the entire
        growing sequence from scratch. For a prompt+generation length of N,
        that's the difference between O(N) and O(N^2) total attention work
        for one generated sequence — the gap grows directly with
        `max_new_tokens` and matters most on CPU/quantized inference where
        there's no GPU parallelism to hide the extra recomputation behind.

        use_cache=False keeps the original recompute-everything-every-step
        behavior, mainly useful for correctness testing against the cached
        path.
        """
        if not use_cache:
            return self._generate_no_cache(
                idx, max_new_tokens, temperature, top_k, top_p,
                repetition_penalty, eos_token_id,
            )

        # Prime the cache with the (possibly truncated) prompt.
        ctx = idx[:, -self.block_size:]
        logits, _, past_kv = self(ctx, use_cache=True)

        for _ in range(max_new_tokens):
            step_logits = logits[:, -1, :] / max(temperature, 1e-5)

            if repetition_penalty != 1.0:
                for b in range(idx.size(0)):
                    seen = torch.unique(idx[b])
                    step_logits[b, seen] /= repetition_penalty

            if top_k is not None:
                v, _ = torch.topk(step_logits, min(top_k, step_logits.size(-1)))
                step_logits[step_logits < v[:, [-1]]] = float("-inf")

            if top_p is not None:
                sorted_logits, sorted_idx = torch.sort(step_logits, descending=True, dim=-1)
                probs = F.softmax(sorted_logits, dim=-1)
                cum_probs = torch.cumsum(probs, dim=-1)
                remove = cum_probs > top_p
                remove[..., 1:] = remove[..., :-1].clone()
                remove[..., 0] = False
                sorted_logits[remove] = float("-inf")
                step_logits = torch.full_like(step_logits, float("-inf")).scatter(
                    -1, sorted_idx, sorted_logits
                )

            probs      = F.softmax(step_logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            idx        = torch.cat([idx, next_token], dim=1)

            if eos_token_id is not None and (next_token == eos_token_id).all():
                break

            cache_len = past_kv[0][0].shape[2]
            if cache_len >= self.block_size:
                # Cache is full — fall back to a full recompute over a
                # truncated (sliding) window, same behavior the no-cache
                # path always used. Rare in practice since block_size
                # defaults to 512 and max_new_tokens defaults to 200.
                ctx = idx[:, -self.block_size:]
                logits, _, past_kv = self(ctx, use_cache=True)
            else:
                logits, _, past_kv = self(next_token, past_kv=past_kv, use_cache=True)

        return idx

    @torch.no_grad()
    def _generate_no_cache(self, idx, max_new_tokens, temperature, top_k,
                            top_p, repetition_penalty, eos_token_id):
        for _ in range(max_new_tokens):
            ctx = idx[:, -self.block_size:]
            logits, _ = self(ctx)
            logits = logits[:, -1, :] / max(temperature, 1e-5)

            if repetition_penalty != 1.0:
                for b in range(idx.size(0)):
                    seen = torch.unique(idx[b])
                    logits[b, seen] /= repetition_penalty

            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = float("-inf")

            if top_p is not None:
                sorted_logits, sorted_idx = torch.sort(logits, descending=True, dim=-1)
                probs = F.softmax(sorted_logits, dim=-1)
                cum_probs = torch.cumsum(probs, dim=-1)
                remove = cum_probs > top_p
                remove[..., 1:] = remove[..., :-1].clone()
                remove[..., 0] = False
                sorted_logits[remove] = float("-inf")
                logits = torch.full_like(logits, float("-inf")).scatter(
                    -1, sorted_idx, sorted_logits
                )

            probs      = F.softmax(logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            idx        = torch.cat([idx, next_token], dim=1)

            if eos_token_id is not None and (next_token == eos_token_id).all():
                break

        return idx

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters())
