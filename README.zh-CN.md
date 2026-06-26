# Token Slimmer

[English](README.md)

面向 LLM agent 的 token 可观测与压缩代理。

Token Slimmer 是一个小型 OpenAI-compatible HTTP proxy，用来减少 agent 工作流里反复发送的输入 token 浪费。它保留项目的核心思路：代理请求、精简 tool schema、压缩 tool/function 输出，并用清晰的估算报告告诉你大概省了多少 token。

项目目标是简单、可检查、适合本地使用。它还不宣称 production-ready。

## 它做什么

```text
Client -> Token Slimmer -> OpenAI-compatible upstream API
```

- 代理 OpenAI-compatible `/v1/chat/completions` 请求。
- 精简重复的 `tools` schema，移除低价值 JSON Schema 元数据。
- 在 `balanced` 和 `aggressive` 模式下压缩 tool/function 输出。
- 对 streaming chat completions 做 passthrough，不解析 SSE chunks。
- 返回估算 token savings headers，并输出一行清楚的请求日志。
- 对未知 `/v1/*` 路径直接转发，避免破坏非 chat API。

## 快速开始

```bash
npm install
cp .env.example .env
npm start
```

默认情况下，代理监听：

```text
http://localhost:3999
```

并转发到：

```text
http://127.0.0.1:3000
```

把 OpenAI-compatible client 的 Base URL 指向：

```text
http://localhost:3999/v1
```

打开本地 dashboard：

```text
http://localhost:3999/dashboard
```

## 配置

| Env var | Default | 说明 |
| --- | --- | --- |
| `PORT` | `3999` | 本地代理端口。 |
| `HOST` | `127.0.0.1` | 监听地址。只有明确要暴露代理，比如 Docker 场景，才建议用 `0.0.0.0`。 |
| `UPSTREAM_URL` | `http://127.0.0.1:3000` | 上游 OpenAI-compatible API base URL，不包含 `/v1`。 |
| `AUTH_MODE` | `forward_client_authorization` | `forward_client_authorization` 或 `configured_upstream_key`。 |
| `UPSTREAM_API_KEY` | empty | 可选上游 key。为空时转发客户端的 `Authorization`。 |
| `MODE` | `safe` | 压缩模式：`safe`、`balanced` 或 `aggressive`。 |
| `CACHE_AWARE` | `0` | 更偏向上游 prompt/cache 稳定性，而不是最大压缩率。 |
| `SLIM_TOOLS` | `1` | 启用 tool schema slimming。 |
| `COMPRESS_CONTENT` | mode-based | tool output compression。`safe` 只做 JSON minification。 |
| `STRIP_TOOLS` | `0` | 只在 `MODE=aggressive` 时生效，而且必须显式设置为 `1`。 |
| `HEARTBEAT_INTERVAL` | `3` | aggressive tools stripping 下，每 N 次请求重新发送一次 tools。 |
| `CAPTURE_REQUESTS` | `0` | 保存传入的 JSON `/v1/*` 请求，用于本地 corpus benchmark。 |
| `CAPTURE_DIR` | `captures` | request capture 文件目录。 |

运行时配置加载优先级：

```text
defaults < config.local.json < environment variables
```

由环境变量设置的字段会在 dashboard 里显示为 locked，不能从 dashboard 编辑。

## Dashboard

Dashboard 是同一个 Express 进程提供的本地状态页：

```text
http://localhost:3999/dashboard
```

它会显示 runtime config、Settings Lite、auth mode、近似总 savings、Token X-Ray、recent requests、单请求 savings breakdown，以及 `aggressive` 或 `STRIP_TOOLS` 的风险提示。页面每 2 秒轮询 `/api/stats`。

Settings Lite 当前可以编辑：

- `UPSTREAM_URL`
- `MODE`
- `AUTH_MODE`
- `UPSTREAM_API_KEY`，只写不读
- `CAPTURE_REQUESTS`
- `CACHE_AWARE`
- `STRIP_TOOLS`
- `HEARTBEAT_INTERVAL`

`HOST` 和 `PORT` 只展示，不做热编辑。以后如果支持修改，应标记为需要重启，不做运行时端口切换。

默认情况下，Token Slimmer 不保存 API key。如果你通过 Settings Lite 保存 `UPSTREAM_API_KEY`，它会写入本地 `config.local.json`；`/api/config` 和 dashboard 只会显示 `not_stored` 或 `configured` 加最后 4 位。空白 key 输入会保留已有 key。使用 “Clear upstream key” 可以清除它。

“Test Upstream” 会调用当前配置的 upstream `/v1/models`，返回 ok/failed 和 HTTP status。错误信息会被清理，避免泄露 key。

## URLs 和 Auth

这里有三个不同概念：

| 项目 | 示例 | 含义 |
| --- | --- | --- |
| Client Base URL | `http://localhost:3999/v1` | 在 agent 或 OpenAI-compatible client 里配置这个地址，让它先请求 Token Slimmer。 |
| Token Slimmer listen URL | `http://localhost:3999` | 本地 proxy server 和 dashboard 的地址。 |
| Upstream URL | `http://127.0.0.1:3000` | Token Slimmer 真正转发到的 OpenAI-compatible API。 |

默认 auth 行为是 pass-through：Token Slimmer 不保存 API keys，只把客户端的 `Authorization` header 转发给 upstream API。

如果设置 `AUTH_MODE=configured_upstream_key` 并配置了 `UPSTREAM_API_KEY`，Token Slimmer 会在转发 upstream 时用：

```text
Authorization: Bearer <UPSTREAM_API_KEY>
```

替换客户端传来的 `Authorization`。它也会移除客户端的 `x-api-key`，避免同时转发两份凭据。完整 key 永远不会从 `/api/config` 返回，也不会显示在 dashboard。

## Token X-Ray：看清 agent 把 token 花在哪里

Agent 工作流经常反复发送大型 tools schema，也会积累很长的 tool outputs 和历史消息。Token X-Ray 会按类别估算 prompt token：

- top-level tools schema
- system messages
- user messages
- assistant messages
- tool messages
- function messages
- other messages

Dashboard 会展示 before/after/saved category breakdown、简单横向条、top token wasters，以及 Recent Requests 里的单请求 X-Ray 展开详情。Corpus benchmark 也会打印 X-Ray category savings。

X-Ray 本身只是观察功能。它不会改变 upstream prompts，不会往 request JSON 里加 metadata，也不会修改会影响模型行为的 messages/tools/headers。

压缩模式会改变发给 upstream 的请求内容，因此可能影响 provider-side prompt/cache behavior。如果你更关心上游 prompt cache 稳定性，而不是最大压缩率，可以启用 cache-aware mode。

## 真实 Hermes capture 结果

以下数字来自本地真实 Hermes capture corpus，不是 synthetic benchmark samples。

| Mode | Original | Compressed | Saved | Saved % | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| `safe` | 1,550,698 | 1,542,375 | 8,323 | 0.5% | 低风险 baseline，收益较小。 |
| `balanced` | 1,550,698 | 1,197,640 | 353,058 | 22.8% | 推荐普通 agent 使用，不 strip tools。 |
| `aggressive` | 1,550,698 | 1,002,979 | 547,719 | 35.3% | 更高 savings，但更有损。 |
| `aggressive` + `STRIP_TOOLS` | 1,550,698 | 712,629 | 838,069 | 54.0% | 实验性选项，可能影响 tool calling。 |

实际效果会随 tools schema 大小、conversation history 和 tool output 体量变化。

## Compression Modes

### `MODE=safe`（默认）

只做低风险变换。

- 转发请求时 minify JSON payload。
- 从 `tools` 移除冗余 schema 字段：`examples`、`example`、`default`、`title`、`$schema`、`markdownDescription` 和 `deprecated`。
- 可能 minify 看起来像 JSON 的 tool output string。
- 不截断 tool output。
- 不 strip `tools`。

### `MODE=balanced`

保守压缩 tool output。

- 包含所有 safe-mode schema slimming。
- 压缩 tool/function output，同时尽量保留重要 error lines、file paths、stack traces、JSON keys 和 command-like output。
- 不 strip `tools`。

### `MODE=aggressive`

给明确接受 agent 行为风险的用户使用的有损模式。

- 包含 safe-mode schema slimming。
- 允许更激进地截断和省略重复输出。
- 只有在 `STRIP_TOOLS=1` 时才可能 strip `tools`。
- 使用 heartbeat 行为周期性重发 cached tools。

`aggressive` 可能影响 tool-calling behavior。只建议在你关心的 agent/provider 组合上测试之后再使用。

### `CACHE_AWARE=1`

Cache-aware mode 不是默认模式。启用后：

- 禁用 tools stripping
- X-Ray observation 仍然工作
- 不添加 request-body metadata
- 更偏向稳定、确定性的 transforms
- 不改 system messages
- 除非显式设置 `SLIM_TOOLS=1`，否则禁用 top-level tool schema slimming

Cache-aware mode 更偏向 upstream cache stability，而不是最大压缩率。

## Response Headers

对 chat completions 和 forwarded JSON `/v1/*` 请求，Token Slimmer 会添加：

| Header | 含义 |
| --- | --- |
| `x-token-slimmer-mode` | 当前模式。 |
| `x-token-slimmer-before-estimate` | 压缩前估算 prompt tokens。 |
| `x-token-slimmer-after-estimate` | 压缩后估算 prompt tokens。 |
| `x-token-slimmer-saved-estimate` | 估算 saved tokens。 |
| `x-token-slimmer-breakdown` | `schema`、`output` 和 `strip` savings breakdown。 |

token estimator 是轻量近似值，用于观测和比较，不用于 billing reconciliation。

日志示例：

```text
[token-slimmer] mode=balanced | POST /v1/chat/completions | before=1200 | after=900 | saved=300 (25.0%) | schema=180 | output=120 | strip=0
```

## Streaming

当 `/v1/chat/completions` 收到 `stream: true` 时，Token Slimmer 会直接转发 upstream response stream。

- 保留 upstream status codes。
- 转发相关 response headers。
- 不解析或重写 streamed chunks。
- 请求压缩仍然发生在发送 upstream request 之前。

## Compatibility

| Target | Status | 说明 |
| --- | --- | --- |
| OpenAI-compatible chat completions | Supported | 主路径：`/v1/chat/completions`。 |
| Streaming chat completions | Supported | SSE chunks 原样代理，不解析。 |
| Unknown `/v1/*` paths | Forwarded | 直接转发 upstream，不做压缩。 |
| Hermes | Expected compatible | 设计上针对重复 tools 和大 tool outputs；仍建议用你的 provider 实测。 |
| OpenClaw | Expected compatible | `safe` 应尽量保持 tool behavior；谨慎测试 `aggressive`。 |
| one-api | Expected compatible | 把 one-api 作为 upstream `UPSTREAM_URL` 使用。 |
| Claude Code / Cursor | Carefully experimental | 这些工具在部分配置下可以使用 OpenAI-compatible endpoints，但取决于当前 provider adapter 和 headers，不要过度承诺兼容。 |

## Benchmarks

Benchmark 是离线的，不需要 API keys。

内置小型 smoke benchmark 适合检查脚本是否可用，但 tiny prompts 看不出真实收益。Agent-heavy requests，尤其是重复 tools schema 和大型 tool outputs，通常会显示更明显 savings。

```bash
npm run bench
MODE=balanced npm run bench
MODE=aggressive STRIP_TOOLS=1 npm run bench
```

benchmark 会打印：

- original estimated prompt tokens
- compressed estimated prompt tokens
- estimated savings
- savings by category
- X-Ray breakdown for tools schema, system/user/assistant messages, tool/function outputs, and other messages
- mode used

### Corpus Benchmarks

用 `bench:corpus` 对多个文件做更真实的模式对比。它会把每个输入分别跑过 `safe`、`balanced`、`aggressive` 和 `aggressive+STRIP_TOOLS`。

```bash
npm run bench:corpus captures/
npm run bench:corpus bench/samples/*.json
```

每个文件会打印：

- original estimated tokens
- compressed estimated tokens
- saved tokens
- saved percent
- savings by tools schema, tool output, and tools stripping
- aggregate X-Ray category totals across all files

`eval:modes` 是同一个 corpus mode comparison 的轻量 alias：

```bash
npm run eval:modes bench/samples
```

合成大样本位于 `bench/samples/`：

- large tool schema
- large JSON tool output
- large log/code output

### Request Capture

开启 capture，从真实流量构建本地 benchmark corpus：

```bash
CAPTURE_REQUESTS=1 CAPTURE_DIR=captures npm start
```

Captured files 包含 method、path、headers 和 body。敏感 headers 和 body fields 会被 redacted，只要 key 是 `authorization`、`api_key`、`token`、`password`、`cookie` 或 `x-api-key`。

## Tests

```bash
npm test
```

测试覆盖：

- schema slimming
- JSON、log、code-like 和 prose-ish output compression behavior
- `safe`、`balanced` 和 `aggressive` 模式边界
- `safe` mode never stripping tools
- aggressive tools stripping only when explicitly enabled
- basic proxy forwarding
- streaming proxy forwarding
- Settings Lite config updates and env locks
- upstream API key masking and clearing
- upstream connectivity test sanitization
- Token X-Ray category breakdowns and redacted previews
- cache-aware mode disabling tools stripping

## Safety Notes

- `safe` 是默认模式，因为 agent compatibility 比最大压缩率更重要。
- `balanced` 适合日常 agent 使用，尤其是 tool outputs 很大的场景。
- `aggressive` 是有损模式，可能改变 agent behavior。依赖它之前，请查看 logs 并用真实 agent 测试。
- X-Ray 只是观察功能，不改变 upstream prompts。
- 压缩模式可能影响 provider-side prompt/cache behavior，因为它们会改变 request content。
- 未知 `/v1/*` 路径默认直接转发，避免破坏非 chat APIs。
- Hop-by-hop request headers 不会被转发。安全的 custom provider headers 会被保留。

## Docker

```bash
docker build -t token-slimmer .
docker run -p 3999:3999 \
  -e HOST=0.0.0.0 \
  -e UPSTREAM_URL=http://host.docker.internal:3000 \
  -e MODE=safe \
  token-slimmer
```

或者：

```bash
docker compose up --build
```

## License

MIT
