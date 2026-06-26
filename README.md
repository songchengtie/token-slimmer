# Token Slimmer

**Token X-Ray and compression proxy for LLM agents.**

See where your agent burns tokens, then reduce repeated tool schemas and bulky tool outputs through a drop-in OpenAI-compatible proxy.

```text
Client / Hermes / OpenClaw / Claude Code
        ↓
Token Slimmer  :3999
        ↓
OpenAI-compatible upstream API
```

## Real Hermes capture results

Measured on a real local Hermes capture corpus with **1,550,698 estimated input tokens**.

| Mode                     | Tools stripped? | Compressed |   Saved | Saved % | Recommended use                       |
| ------------------------ | --------------: | ---------: | ------: | ------: | ------------------------------------- |
| safe                     |              no |  1,542,375 |   8,323 |    0.5% | low-risk baseline                     |
| balanced                 |              no |  1,197,640 | 353,058 |   22.8% | recommended for normal agent use      |
| aggressive               |              no |  1,002,979 | 547,719 |   35.3% | higher compression, lossy             |
| aggressive + STRIP_TOOLS |             yes |    712,629 | 838,069 |   54.0% | experimental, may affect tool calling |

> Token accounting is approximate and intended for comparison, not billing reconciliation.

<img width="2556" height="1037" alt="image" src="https://github.com/user-attachments/assets/e19c5c5c-f5ed-4f25-9dda-8f6509926dc3" />

<img width="2517" height="764" alt="image" src="https://github.com/user-attachments/assets/c7972305-c63c-4f6a-8b45-20989b81d2fd" />

## What It Does

Client -> Token Slimmer -> OpenAI-compatible upstream API

- Proxies OpenAI-compatible `/v1/chat/completions` requests.
- Slims repeated tool schemas by removing redundant JSON Schema metadata.
- Compresses tool/function outputs in balanced and aggressive modes.
- Passes streaming chat completion responses through without parsing chunks.
- Adds estimated token savings headers and one-line request logs.
- Forwards unknown `/v1/*` paths without compression for compatibility.

## Quick Start

```bash
npm install
cp .env.example .env
npm start
```

By default the proxy listens on `http://localhost:3999` and forwards to
`http://127.0.0.1:3000`.

Point an OpenAI-compatible client at:

```text
http://localhost:3999/v1
```

Open the local dashboard at:

```text
http://localhost:3999/dashboard
```

## Configuration

| Env var | Default | Description |
| --- | --- | --- |
| `PORT` | `3999` | Local proxy port. |
| `HOST` | `127.0.0.1` | Listen host. Use `0.0.0.0` only when intentionally exposing the proxy, such as in Docker. |
| `UPSTREAM_URL` | `http://127.0.0.1:3000` | Upstream OpenAI-compatible API base URL, without `/v1`. |
| `AUTH_MODE` | `forward_client_authorization` | `forward_client_authorization` or `configured_upstream_key`. |
| `UPSTREAM_API_KEY` | empty | Optional upstream key. When empty, client `Authorization` is forwarded. |
| `MODE` | `safe` | Compression mode: `safe`, `balanced`, or `aggressive`. |
| `CACHE_AWARE` | `0` | Favor upstream prompt/cache stability over maximum compression. |
| `SLIM_TOOLS` | `1` | Enable tool schema slimming. |
| `COMPRESS_CONTENT` | mode-based | Tool output compression. In `safe`, only JSON minification is used. |
| `STRIP_TOOLS` | `0` | Only honored in `MODE=aggressive`; must be explicitly set to `1`. |
| `HEARTBEAT_INTERVAL` | `3` | In aggressive tools stripping, send tools every N requests. |
| `CAPTURE_REQUESTS` | `0` | Save incoming JSON `/v1/*` requests for local corpus benchmarks. |
| `CAPTURE_DIR` | `captures` | Directory for captured request JSON files. |

Runtime config load priority is:

```text
defaults < config.local.json < environment variables
```

Fields set by environment variables are shown as locked in the dashboard and
cannot be edited there.

## Dashboard

The dashboard is a local-first status page served by the same Express process:


```text
http://localhost:3999/dashboard
```

It shows runtime config, Settings Lite, auth mode, approximate total savings,
Token X-Ray, recent requests, per-request savings breakdown, and warnings for
aggressive mode or tools stripping. It polls `/api/stats` every 2 seconds.

Settings Lite can edit:

- `UPSTREAM_URL`
- `MODE`
- `AUTH_MODE`
- `UPSTREAM_API_KEY` as a write-only field
- `CAPTURE_REQUESTS`
- `CACHE_AWARE`
- `STRIP_TOOLS`
- `HEARTBEAT_INTERVAL`

`HOST` and `PORT` are visible but not hot-editable. Changing those later should
be treated as restart-required.

The optional upstream key is not stored by default. If you save one through
Settings Lite, it is written to local `config.local.json`; `/api/config` and the
dashboard only report `not_stored` or `configured` with the last 4 characters.
Blank key input keeps the existing key. Use "Clear upstream key" to remove it.

Use "Test Upstream" to call the configured upstream `/v1/models`. The response
reports ok/failed and HTTP status, with errors sanitized so keys are not leaked.

Screenshot placeholder:

```text
Dashboard screenshot to be added after the first visual release check.
```

## URLs And Auth

There are three separate concepts:

| Item | Example | Meaning |
| --- | --- | --- |
| Client Base URL | `http://localhost:3999/v1` | Configure your agent or OpenAI-compatible client to call Token Slimmer here. |
| Token Slimmer listen URL | `http://localhost:3999` | Local proxy server and dashboard origin. |
| Upstream URL | `http://127.0.0.1:3000` | The OpenAI-compatible API Token Slimmer forwards to. |

Default auth behavior is pass-through: Token Slimmer does not store API keys and
forwards the client's `Authorization` header to the upstream API.

If `AUTH_MODE=configured_upstream_key` and `UPSTREAM_API_KEY` is configured,
Token Slimmer replaces the client `Authorization` header with
`Authorization: Bearer <UPSTREAM_API_KEY>` when forwarding upstream. It also
removes client `x-api-key` to avoid forwarding two credentials. The full key is
never returned by `/api/config` or shown in the dashboard.

## Token X-Ray: see where your agent burns tokens

Agent workflows often repeat large tools schemas and accumulate long tool
outputs or history messages. Token X-Ray estimates prompt tokens by category:

- top-level tools schema
- system messages
- user messages
- assistant messages
- tool messages
- function messages
- other messages

The dashboard shows before/after/saved category breakdowns, simple bars, top
token wasters, and per-request X-Ray expansion from the Recent Requests table.
Corpus benchmarks also print X-Ray category savings.

X-Ray itself is observational only. It does not change upstream prompts, add
metadata to request JSON, or alter messages/tools/headers that affect model
behavior.

Compression modes can change upstream request content and may affect
provider-side prompt/cache behavior. Use cache-aware mode if upstream prompt
cache stability matters more than maximum compression.

Observed savings from a real local Hermes capture corpus:

- safe: 0.5% saved. This is the low-risk baseline with small savings.
- balanced: 22.8% saved without tools stripping. This is recommended for normal agent use.
- aggressive: 35.3% saved without tools stripping. This is higher saving but more lossy.
- aggressive+`STRIP_TOOLS`: 54.0% saved. This is experimental and may affect tool calling.

These numbers are from captured Hermes traffic, not synthetic benchmark samples.
Your results will vary with tools schema size, conversation history, and tool
output volume.

## Compression Modes

### `MODE=safe` (default)

Low-risk transforms only.

- Minifies JSON payloads when the request is forwarded.
- Removes redundant schema fields from `tools`: `examples`, `example`,
  `default`, `title`, `$schema`, `markdownDescription`, and `deprecated`.
- May minify JSON-looking tool output strings.
- Does not truncate tool output.
- Does not strip `tools`.

### `MODE=balanced`

Conservative tool output compression.

- Includes all safe-mode schema slimming.
- Compresses tool/function output while preserving important error lines,
  file paths, stack traces, JSON keys, and command-like output.
- Does not strip `tools`.

### `MODE=aggressive`

Lossy mode for users who explicitly accept agent behavior risk.

- Includes safe-mode schema slimming.
- Allows more aggressive truncation and omission of repetitive output.
- Can strip `tools` only when `STRIP_TOOLS=1`.
- Uses heartbeat behavior to periodically resend cached tools.

Aggressive mode may affect tool-calling behavior. Use it only after testing the
agent and provider combination you care about.

### `CACHE_AWARE=1`

Cache-aware mode is not the default. When enabled:

- tools stripping is disabled
- X-Ray observation still works
- request-body metadata is never added
- deterministic transforms are preferred
- system messages are left alone
- top-level tool schema slimming is disabled unless `SLIM_TOOLS=1` is explicitly configured

Cache-aware mode favors upstream cache stability over maximum compression.

## Response Headers

For chat completions and forwarded JSON `/v1/*` requests, Token Slimmer adds:

| Header | Meaning |
| --- | --- |
| `x-token-slimmer-mode` | Active mode. |
| `x-token-slimmer-before-estimate` | Estimated prompt tokens before compression. |
| `x-token-slimmer-after-estimate` | Estimated prompt tokens after compression. |
| `x-token-slimmer-saved-estimate` | Estimated tokens saved. |
| `x-token-slimmer-breakdown` | Savings by `schema`, `output`, and `strip`. |

The token estimator is intentionally lightweight and approximate. It is for
observability and comparison, not billing reconciliation.

Each request also logs one line like:

```text
[token-slimmer] mode=balanced | POST /v1/chat/completions | before=1200 | after=900 | saved=300 (25.0%) | schema=180 | output=120 | strip=0
```

## Streaming

When `/v1/chat/completions` receives `stream: true`, Token Slimmer forwards the
upstream response stream directly to the client.

- It preserves upstream status codes.
- It forwards relevant response headers.
- It does not parse or rewrite streamed chunks.
- Request compression still happens before the upstream request is sent.

## Compatibility

| Target | Status | Notes |
| --- | --- | --- |
| OpenAI-compatible chat completions | Supported | Primary path: `/v1/chat/completions`. |
| Streaming chat completions | Supported | SSE chunks are proxied without parsing. |
| Unknown `/v1/*` paths | Forwarded | Sent upstream without compression. |
| Hermes | Expected compatible | Designed around repeated tools and large tool outputs; test with your provider. |
| OpenClaw | Expected compatible | Safe mode should preserve tool behavior; test aggressive mode carefully. |
| one-api | Expected compatible | Use one-api as the upstream `UPSTREAM_URL`. |
| Claude Code / Cursor | Carefully experimental | These tools can use OpenAI-compatible endpoints in some setups, but behavior depends on their current provider adapter and headers. Do not assume full compatibility without testing. |

## Benchmarks

Benchmarking is offline and does not require API keys.

The small built-in smoke benchmark is useful for checking the script, but tiny
prompts do not show real-world savings. Agent-heavy requests with repeated tool
schemas and large tool outputs usually show much larger savings.

```bash
npm run bench
MODE=balanced npm run bench
MODE=aggressive STRIP_TOOLS=1 npm run bench
```

The benchmark prints:

- original estimated prompt tokens
- compressed estimated prompt tokens
- estimated savings
- savings by category
- X-Ray breakdown for tools schema, system/user/assistant messages,
  tool/function outputs, and other messages
- mode used

### Corpus Benchmarks

Use `bench:corpus` for realistic comparisons across files. It runs every input
through `safe`, `balanced`, `aggressive`, and `aggressive+STRIP_TOOLS`.

```bash
npm run bench:corpus captures/
npm run bench:corpus bench/samples/*.json
```

For each file, it prints:

- original estimated tokens
- compressed estimated tokens
- saved tokens
- saved percent
- savings by tools schema, tool output, and tools stripping
- aggregate X-Ray category totals across all files

`eval:modes` is a lightweight alias for the same corpus mode comparison:

```bash
npm run eval:modes bench/samples
```

Synthetic larger samples live in `bench/samples/`:

- large tool schema
- large JSON tool output
- large log/code output

### Request Capture

Enable capture to build a local benchmark corpus from real traffic:

```bash
CAPTURE_REQUESTS=1 CAPTURE_DIR=captures npm start
```

Captured files include method, path, headers, and body. Sensitive headers and
body fields are redacted when their key is `authorization`, `api_key`, `token`,
`password`, `cookie`, or `x-api-key`.

## Tests

```bash
npm test
```

The test suite covers:

- schema slimming
- JSON, log, code-like, and prose-ish output compression behavior
- safe, balanced, and aggressive mode boundaries
- safe mode never stripping tools
- aggressive tools stripping only when explicitly enabled
- basic proxy forwarding
- streaming proxy forwarding
- Settings Lite config updates and env locks
- upstream API key masking and clearing
- upstream connectivity test sanitization
- Token X-Ray category breakdowns and redacted previews
- cache-aware mode disabling tools stripping

## Safety Notes

- Safe mode is the default because agent compatibility matters more than maximum
  compression.
- Balanced mode is intended for day-to-day agent use when tool outputs are large.
- Aggressive mode is lossy and can change agent behavior. Review logs and test
  with your real agent before relying on it.
- X-Ray is observational only and does not change upstream prompts.
- Compression modes may affect provider-side prompt/cache behavior because they
  can change request content.
- Unknown `/v1/*` paths are forwarded without compression to avoid surprising
  non-chat APIs.
- Hop-by-hop request headers are not forwarded. Custom provider headers are
  preserved when safe to forward.

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

## License

MIT
