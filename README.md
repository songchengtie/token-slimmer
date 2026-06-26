# Token Slimmer

[简体中文](README.zh-CN.md)

Token Slimmer is an OpenAI-compatible proxy for LLM agents. It provides Token X-Ray observability, slims repeated tool schemas, compresses large tool/function outputs, and can optionally summarize repeated large outputs with a local cache.

```text
Client / Hermes / OpenClaw / Claude Code
        ->
Token Slimmer :3999
        ->
OpenAI-compatible upstream API
```

Token accounting is approximate and intended for comparison, not billing reconciliation.

## What It Does

- Proxies OpenAI-compatible `/v1/chat/completions` requests.
- Passes streaming chat completion responses through without parsing chunks.
- Forwards unknown `/v1/*` paths upstream without compression.
- Slims repeated tool schemas by removing redundant JSON Schema metadata.
- Compresses tool/function outputs in `balanced` and `aggressive` modes.
- Reports estimated token savings in response headers, logs, dashboard stats, and benchmark reports.
- Shows Token X-Ray breakdowns by tools schema, system/user/assistant/tool/function messages, and other messages.
- Optionally uses a local summary cache for repeated large tool/function outputs.

## Why It Helps Agents

Agent traffic often repeats large tool schemas and carries long command outputs, file reads, JSON results, logs, and history messages. Token Slimmer is designed to make that cost visible and reduce low-value repeated content while preserving agent compatibility as the priority.

Typical use cases:

- Compare estimated prompt tokens before and after compression.
- See which categories consume the most tokens.
- Reduce repeated tool schema overhead.
- Compress noisy tool/function outputs while preserving errors, paths, stack traces, JSON keys, and command context.
- Build benchmark corpora from captured local agent traffic.

## Quick Start

```bash
npm install
cp .env.example .env
npm start
```

By default Token Slimmer listens on:

```text
http://localhost:3999
```

Point an OpenAI-compatible client at:

```text
http://localhost:3999/v1
```

Open the dashboard at:

```text
http://localhost:3999/dashboard
```

By default, Token Slimmer forwards to:

```text
http://127.0.0.1:3000
```

## Recommended Settings

Normal use:

```env
MODE=balanced
STRIP_TOOLS=0
SUMMARY_CACHE=0
AGENT_PROFILE=generic
PROVIDER_PROFILE=generic
```

Hermes/OpenClaw experimental use:

```env
MODE=balanced
AGENT_PROFILE=hermes
PROVIDER_PROFILE=openai
SUMMARY_CACHE=1
```

`balanced` is recommended for normal agent use. Summary cache is experimental and disabled by default; enable it only after testing with your real agent workflow.

## Dashboard

The local dashboard is served by the same Express process:

```text
http://localhost:3999/dashboard
```

It shows:

- current runtime config
- Settings Lite
- auth mode and API key status
- approximate total savings
- Token X-Ray category breakdowns
- recent request stats
- per-request savings breakdown
- warnings for `aggressive`, `STRIP_TOOLS`, and cache-aware behavior

It polls `/api/stats` every 2 seconds.

![Token Slimmer dashboard](https://github.com/user-attachments/assets/e19c5c5c-f5ed-4f25-9dda-8f6509926dc3)

![Token X-Ray dashboard table](https://github.com/user-attachments/assets/c7972305-c63c-4f6a-8b45-20989b81d2fd)

## Compression Modes

### `MODE=safe`

Safe mode is the lowest-risk baseline.

- Minifies JSON payloads where safe.
- Removes redundant schema fields such as `examples`, `example`, `default`, `title`, `$schema`, `markdownDescription`, and `deprecated`.
- May minify JSON-looking tool output strings.
- Does not truncate plain tool output.
- Does not strip `tools`.

### `MODE=balanced`

Balanced mode is recommended for daily agent use.

- Includes safe-mode schema slimming.
- Compresses tool/function output conservatively.
- Preserves important error lines, file paths, stack traces, JSON keys, command output, and exit status.
- Does not strip `tools`.

### `MODE=aggressive`

Aggressive mode is lossy and may affect agent behavior.

- Includes safe-mode schema slimming.
- Allows more truncation and omission of repetitive output.
- Can strip `tools` only when `STRIP_TOOLS=1`.
- Uses heartbeat behavior to periodically resend cached tools.

Use aggressive mode only after testing with the agent and provider combination you care about.

### `CACHE_AWARE=1`

Cache-aware mode favors upstream prompt cache stability over maximum compression.

- Disables tools stripping.
- Keeps X-Ray observation enabled.
- Does not add request-body metadata.
- Prefers stable deterministic transforms.
- Leaves system messages alone.
- Disables top-level tool schema slimming unless `SLIM_TOOLS=1` is explicitly configured.

## Provider and Agent Profiles

Provider profiles affect token estimation only. They are lightweight heuristics today, structured so exact tokenizers can be plugged in later.

Supported `PROVIDER_PROFILE` values:

```text
generic, openai, anthropic, gemini, deepseek, qwen
```

Default:

```env
PROVIDER_PROFILE=generic
```

Agent profiles affect tool/function output compression strategy. They do not change user, system, or assistant messages.

Supported `AGENT_PROFILE` values:

```text
generic, hermes, openclaw, codex, claude-code
```

Default:

```env
AGENT_PROFILE=generic
```

The Hermes/OpenClaw/Codex profiles preserve agent-relevant structure for files, logs, shell output, diffs, and test failures. Unknown or unclassified output falls back to the generic balanced/aggressive behavior.

## Summary Cache

Summary cache is experimental and disabled by default.

```env
SUMMARY_CACHE=0
SUMMARY_CACHE_DIR=.token-slimmer-cache
SUMMARY_CACHE_MIN_TOKENS=1200
```

When enabled, Token Slimmer hashes large tool/function outputs. If the same content appears again, it can replace the repeated output with a compact local reference and deterministic summary.

The summary cache:

- is local only
- does not call an LLM
- stores summaries by default, not full raw tool output
- skips sensitive-looking content such as API keys, bearer tokens, cookies, passwords, `.env` style secrets, and private keys
- may affect agent behavior and should be tested with real workflows before use

## Benchmarks

Benchmarking is offline and does not require API keys.

```bash
npm run bench
npm run bench:corpus captures/
```

v0.5-beta balanced benchmark results from a local Hermes capture corpus:

```text
Corpus: 58 captured requests
```

| Variant | Mode | Summary cache | Original | Compressed | Saved | Saved % | Summary cache contribution |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| default | balanced | off | 1,550,698 | 1,197,640 | 353,058 | 22.8% | 0 |
| openai/hermes/cache 0 | balanced | off | 1,550,698 | 1,197,640 | 353,058 | 22.8% | 0 |
| openai/hermes/cache 1 | balanced | on | 1,550,698 | 1,088,875 | 461,823 | 29.8% | 302,956 |

Mode comparison on the same corpus:

| Mode | Original | Compressed | Saved | Saved % | Recommended use |
| --- | ---: | ---: | ---: | ---: | --- |
| safe | 1,550,698 | 1,542,375 | 8,323 | 0.5% | lowest-risk baseline |
| balanced | 1,550,698 | 1,197,640 | 353,058 | 22.8% | recommended for normal agent use |
| aggressive | 1,550,698 | 1,002,979 | 547,719 | 35.3% | lossy, test first |
| aggressive + `STRIP_TOOLS` | 1,550,698 | 712,629 | 838,069 | 54.0% | experimental, may affect tool calling |

Results depend on traffic patterns, tool schema size, conversation history, and tool output volume. These numbers are estimates and should not be used as billing reconciliation.

`bench:corpus` accepts files, directories, and globs:

```bash
npm run bench:corpus captures/
npm run bench:corpus bench/samples/*.json
```

`eval:modes` is an alias for corpus mode comparison:

```bash
npm run eval:modes bench/samples
```

## Compatibility

| Target | Status | Notes |
| --- | --- | --- |
| OpenAI-compatible chat completions | Supported | Primary path: `/v1/chat/completions`. |
| Streaming chat completions | Supported | SSE chunks are proxied without parsing. |
| Unknown `/v1/*` paths | Forwarded | Sent upstream without compression. |
| Hermes | Expected compatible | Designed around repeated tools and large tool outputs; test with your provider. |
| OpenClaw | Expected compatible | Safe and balanced modes should preserve tool behavior; test aggressive mode carefully. |
| one-api | Expected compatible | Use one-api as the upstream `UPSTREAM_URL`. |
| Claude Code / Cursor | Carefully experimental | Behavior depends on their current provider adapter and headers. Do not assume full compatibility without testing. |

## Safety Notes

- Safe mode is the lowest-risk baseline.
- Balanced mode is recommended for normal daily use.
- Aggressive mode is lossy and may affect agent behavior.
- `STRIP_TOOLS` may affect tool calling.
- Summary cache is experimental, disabled by default, and may affect agent behavior.
- Streaming responses are proxied without parsing chunks.
- Unknown `/v1/*` paths are forwarded without compression.
- Token accounting is approximate and intended for comparison, not billing reconciliation.
- Compression modes can affect provider-side prompt/cache behavior because they change request content.
- Token X-Ray itself is observational only and does not add model-visible metadata.
- Hop-by-hop request headers are not forwarded. Custom provider headers are preserved when safe to forward.

## Configuration

Runtime config load priority:

```text
defaults < config.local.json < environment variables
```

Fields set by environment variables are shown as locked in the dashboard and cannot be edited there.

| Env var | Default | Description |
| --- | --- | --- |
| `PORT` | `3999` | Local proxy port. |
| `HOST` | `127.0.0.1` | Listen host. Use `0.0.0.0` only when intentionally exposing the proxy, such as in Docker. |
| `UPSTREAM_URL` | `http://127.0.0.1:3000` | Upstream OpenAI-compatible API base URL, without `/v1`. |
| `AUTH_MODE` | `forward_client_authorization` | `forward_client_authorization` or `configured_upstream_key`. |
| `UPSTREAM_API_KEY` | empty | Optional upstream key. When empty, client `Authorization` is forwarded. |
| `MODE` | `safe` | Compression mode: `safe`, `balanced`, or `aggressive`. |
| `PROVIDER_PROFILE` | `generic` | Token estimation profile. |
| `AGENT_PROFILE` | `generic` | Agent-aware tool/function output compression profile. |
| `CACHE_AWARE` | `0` | Favor upstream prompt/cache stability over maximum compression. |
| `SUMMARY_CACHE` | `0` | Experimental local summary cache. Disabled by default. |
| `SUMMARY_CACHE_DIR` | `.token-slimmer-cache` | Directory for summary-only cache JSON files. |
| `SUMMARY_CACHE_MIN_TOKENS` | `1200` | Minimum estimated original tool/function output tokens before summary cache is considered. |
| `SLIM_TOOLS` | `1` | Enable tool schema slimming. |
| `COMPRESS_CONTENT` | `1` | Enable tool/function output compression. In safe mode this only minifies JSON-looking output. |
| `STRIP_TOOLS` | `0` | Only honored in `MODE=aggressive`; must be explicitly set to `1`. |
| `HEARTBEAT_INTERVAL` | `3` | In aggressive tools stripping, send tools every N requests. |
| `CAPTURE_REQUESTS` | `0` | Save incoming JSON `/v1/*` requests for local corpus benchmarks. |
| `CAPTURE_DIR` | `captures` | Directory for captured request JSON files. |

### URLs and Auth

| Item | Example | Meaning |
| --- | --- | --- |
| Client Base URL | `http://localhost:3999/v1` | Configure your agent or OpenAI-compatible client to call Token Slimmer here. |
| Token Slimmer listen URL | `http://localhost:3999` | Local proxy server and dashboard origin. |
| Upstream URL | `http://127.0.0.1:3000` | The OpenAI-compatible API Token Slimmer forwards to. |

Default auth behavior is pass-through: Token Slimmer does not store API keys and forwards the client's `Authorization` header to the upstream API.

If `AUTH_MODE=configured_upstream_key` and `UPSTREAM_API_KEY` is configured, Token Slimmer replaces the client `Authorization` header with `Authorization: Bearer <UPSTREAM_API_KEY>` when forwarding upstream. It also removes client `x-api-key` to avoid forwarding two credentials. The full key is never returned by `/api/config` or shown in the dashboard.

### Response Headers

For chat completions and forwarded JSON `/v1/*` requests, Token Slimmer adds:

| Header | Meaning |
| --- | --- |
| `x-token-slimmer-mode` | Active mode. |
| `x-token-slimmer-provider-profile` | Active provider token estimation profile. |
| `x-token-slimmer-before-estimate` | Estimated prompt tokens before compression. |
| `x-token-slimmer-after-estimate` | Estimated prompt tokens after compression. |
| `x-token-slimmer-saved-estimate` | Estimated tokens saved. |
| `x-token-slimmer-breakdown` | Savings by `schema`, `output`, and `strip`. |

Example log line:

```text
[token-slimmer] mode=balanced | POST /v1/chat/completions | before=1200 | after=900 | saved=300 (25.0%) | schema=180 | output=120 | strip=0
```

## Request Capture

Enable capture to build a local benchmark corpus from real traffic:

```bash
CAPTURE_REQUESTS=1 CAPTURE_DIR=captures npm start
```

Captured files include method, path, headers, and body. Sensitive headers and body fields are redacted when their key is `authorization`, `api_key`, `token`, `password`, `cookie`, or `x-api-key`.

Do not commit local captures. They are ignored by `.gitignore`.

## Docker

```bash
docker build -t token-slimmer .
docker run -p 3999:3999 \
  -e HOST=0.0.0.0 \
  -e UPSTREAM_URL=http://host.docker.internal:3000 \
  -e MODE=safe \
  token-slimmer
```

Or use:

```bash
docker compose up --build
```

## Tests

```bash
npm run lint
npm test
```

The test suite covers schema slimming, compression mode boundaries, safe mode behavior, proxy forwarding, streaming passthrough, request stats, Settings Lite config updates, Token X-Ray breakdowns, provider/agent profiles, summary cache behavior, and redaction.

## License

MIT
