# 🪢 Token Slimmer

> **LLM request compression proxy** — drop it in front of any OpenAI-compatible client and **save 50-60% on input tokens**. Zero code changes.

```
Client → Token Slimmer → Upstream API (One-API / OpenAI / anything)
         ↕ saves 58.8% tokens
```

---

## Why you need this

If you use **LLM agents** (Hermes, Claude Code, Cursor, OpenClaw, etc.), **90%+ of your token spend is on input** — tools schemas, tool outputs, system prompts sent over and over. Thousands of tokens per turn, burned for nothing.

**Hermes and OpenClaw** are especially heavy: they send the full tools definition on every request, and tool outputs can be 50K+ tokens per turn. Token Slimmer is designed specifically for this pattern.

Token Slimmer sits between your client and the API, automatically compressing the waste:

| You care about | Token Slimmer does |
|-----------|-------------------|
| 💰 **Cost** | Cuts input tokens by 50-60%, halves API bills |
| ⚡ **Speed** | Less data to transfer, lower time-to-first-token |
| 🔧 **Zero config** | Change one line (`base_url`) and you're in |
| 🔒 **Safe** | Pure text transforms — no semantic changes, no output tampering |

---

## Benchmarks

| Item | Before | After | Savings |
|------|--------|--------|:----:|
| **Prompt tokens** | 1,190 | 490 | **58.8%** |
| **Tools schema (per turn)** | ~15K | ~6K | **~9K** |
| **Tool output (per turn)** | ~53K | ~30K | **~23K** |

> Bigger messages save more. A real 39-message conversation went from 53,008 → 29,885 tokens.

---

## One-liner start

```bash
npm install && node server.js
```

Listens on `http://localhost:3999`, forwards to `http://127.0.0.1:3000`.

---

## How to connect

Point your client's `base_url` to `http://localhost:3999`:

### Hermes

```yaml
# config.yaml
providers:
  - name: slimmer
    api_key: your-key
    base_url: http://localhost:3999
    api_mode: chat_completions
```

### OpenClaw

```yaml
# openclaw config
api_base: http://localhost:3999
```

### Claude Code / any OpenAI client

```bash
export OPENAI_BASE_URL=http://localhost:3999/v1
```

### curl test

```bash
curl http://localhost:3999/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer *** \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}'
```

---

## Configuration

| Env var | Default | Description |
|---------|--------|------|
| `UPSTREAM_URL` | `http://127.0.0.1:3000` | Upstream API endpoint |
| `PORT` | `3999` | Local listen port |
| `SLIM_TOOLS` | `1` | Slim tools schemas (set `0` to disable) |
| `COMPRESS_CONTENT` | `1` | Compress tool outputs (set `0` to disable) |
| `STRIP_TOOLS` | `1` | Strip tools definitions + heartbeat (set `0` to disable) |
| `HEARTBEAT_INTERVAL` | `3` | Send full tools every N requests |

---

## How it works

### 1. Tools schema slimming
Removes `examples`, `default`, `title`, `$schema` and other redundant fields. Truncates descriptions. Saves ~9K tokens per turn.

### 2. Tool output compression
Auto-detects content type and picks the best strategy:

| Type | Strategy | Savings |
|------|----------|---------|
| JSON | minify + columnar compression | 40-60% |
| Code | strip ANSI codes, merge blank lines, truncate long lines | 30-50% |
| Logs | strip separators, keep key lines | 50-70% |
| Prose | strip extra whitespace, truncate | 10-20% |

### 3. JSON inner drilling
Parses the `output` field inside tool results, compresses it by type, then re-wraps.

### 4. Tools stripping + heartbeat
Sends full tools definition on the first request, strips them on subsequent ones, sends a heartbeat every N requests to refresh. Saves ~314 tokens per turn.

---

## Docker

```bash
docker run -d -p 3999:3999 \
  -e UPSTREAM_URL=http://your-api:3000 \
  token-slimmer
```

Or use the included `docker-compose.yml`.

---

## Direct API vs Slimmer

```
Direct API:   15K tokens/turn → 15K tokens (100%)
With Slimmer: 15K tokens/turn →  6K tokens  (40%)
                                save 9K      (60%)
```

Numbers don't lie. Saved tokens = saved money.

---

## Status

✅ Production-ready — verified with Hermes + One-API in real use.

---

MIT License · Made by [songchengtie](https://github.com/songchengtie)
