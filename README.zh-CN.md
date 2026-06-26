# Token Slimmer

[English](README.md)

Token Slimmer 是一个面向 LLM agent 的 OpenAI-compatible 压缩代理。它提供 Token X-Ray 诊断能力，可以观察 token 消耗，精简重复的工具 schema，压缩较大的工具输出，并可选地为重复的大型输出启用本地摘要缓存。

```text
Client / Hermes / OpenClaw / Claude Code
        ->
Token Slimmer :3999
        ->
OpenAI-compatible upstream API
```

Token 统计是估算值，适合做对比和观察，不适合作为账单级精确计算。

## 它做什么

- 代理 OpenAI-compatible `/v1/chat/completions` 请求。
- 对 streaming chat completions 做透传，不解析 SSE chunks。
- 对未知 `/v1/*` 路径直接转发到上游，不做压缩，减少兼容性风险。
- 精简重复的工具 schema，移除低价值 JSON Schema 元数据。
- 在 `balanced` 和 `aggressive` 模式下压缩 tool/function 输出。
- 在响应 header、日志、dashboard 和 benchmark 报告中显示估算 token savings。
- 通过 Token X-Ray 按工具 schema、system/user/assistant/tool/function messages 等类别展示 token 消耗。
- 可选启用本地 summary cache，对重复出现的大型工具输出使用确定性摘要引用。

## 为什么对 Agent 有用

Agent 流量通常会反复发送较大的工具定义，并携带很长的命令输出、文件读取结果、JSON 结果、日志和历史消息。Token Slimmer 的目标是先让这些成本可见，再在尽量保留 agent 兼容性的前提下减少低价值重复内容。

常见用途：

- 对比压缩前后的估算 prompt tokens。
- 看清 token 主要花在哪些类别上。
- 减少重复工具 schema 的开销。
- 压缩噪声较多的 tool/function 输出，同时保留错误、路径、堆栈、JSON key 和命令上下文。
- 从本地真实 agent 流量中采集 benchmark corpus。

## 快速开始

```bash
npm install
cp .env.example .env
npm start
```

默认监听地址：

```text
http://localhost:3999
```

把 OpenAI-compatible client 的 Base URL 指向：

```text
http://localhost:3999/v1
```

打开本地 dashboard：

```text
http://localhost:3999/dashboard
```

默认上游地址：

```text
http://127.0.0.1:3000
```

## 推荐配置

日常使用：

```env
MODE=balanced
STRIP_TOOLS=0
SUMMARY_CACHE=0
AGENT_PROFILE=generic
PROVIDER_PROFILE=generic
```

Hermes / OpenClaw 实验性使用：

```env
MODE=balanced
AGENT_PROFILE=hermes
PROVIDER_PROFILE=openai
SUMMARY_CACHE=1
```

`balanced` 适合作为日常 agent 使用的推荐模式。summary cache 是实验性功能，默认关闭；只有在你用真实 agent 工作流测试过之后，才建议开启。

## Dashboard

Dashboard 由同一个 Express 进程提供：

```text
http://localhost:3999/dashboard
```

它会显示：

- 当前运行配置
- Settings Lite
- auth mode 和 API key 状态
- 估算总节省量
- Token X-Ray 分类统计
- 最近请求列表
- 单请求 savings breakdown
- `aggressive`、`STRIP_TOOLS` 和 cache-aware 行为的风险提示

页面每 2 秒轮询一次 `/api/stats`。

![Token Slimmer dashboard](https://github.com/user-attachments/assets/e19c5c5c-f5ed-4f25-9dda-8f6509926dc3)

![Token X-Ray dashboard table](https://github.com/user-attachments/assets/c7972305-c63c-4f6a-8b45-20989b81d2fd)

## 压缩模式

### `MODE=safe`

安全模式是最低风险的 baseline。

- 在安全场景下 minify JSON。
- 从工具 schema 中移除冗余字段，例如 `examples`、`example`、`default`、`title`、`$schema`、`markdownDescription` 和 `deprecated`。
- 可能 minify 看起来像 JSON 的 tool output string。
- 不截断普通工具输出。
- 不 strip `tools`。

### `MODE=balanced`

平衡模式推荐用于日常 agent 工作流。

- 包含 safe mode 的 schema slimming。
- 保守压缩 tool/function 输出。
- 尽量保留重要错误行、文件路径、堆栈、JSON key、命令输出和 exit status。
- 不 strip `tools`。

### `MODE=aggressive`

激进模式是有损模式，可能影响 agent 行为。

- 包含 safe mode 的 schema slimming。
- 允许更多截断和省略重复输出。
- 只有在 `STRIP_TOOLS=1` 时才可能 strip `tools`。
- 使用 heartbeat 机制周期性重新发送 cached tools。

请只在你关心的 agent/provider 组合上测试后，再使用激进模式。

### `CACHE_AWARE=1`

Cache-aware mode 更偏向上游 prompt cache 稳定性，而不是最大压缩率。

- 禁用 tools stripping。
- 保留 X-Ray 观察能力。
- 不添加 request-body metadata。
- 偏向稳定、确定性的 transforms。
- 不改 system messages。
- 除非显式设置 `SLIM_TOOLS=1`，否则禁用 top-level tool schema slimming。

## Provider 和 Agent Profiles

Provider profiles 只影响 token 估算。当前实现是轻量启发式估算，代码结构上预留了以后接入精确 tokenizer 的空间。

支持的 `PROVIDER_PROFILE`：

```text
generic, openai, anthropic, gemini, deepseek, qwen
```

默认：

```env
PROVIDER_PROFILE=generic
```

Agent profiles 会影响 tool/function 输出的压缩策略，但不会修改 user、system 或 assistant messages。

支持的 `AGENT_PROFILE`：

```text
generic, hermes, openclaw, codex, claude-code
```

默认：

```env
AGENT_PROFILE=generic
```

Hermes / OpenClaw / Codex profiles 会更注意保留 agent 相关结构，例如文件内容、日志、shell 输出、diff 和测试失败信息。未知或无法分类的输出会回退到 generic 的 balanced/aggressive 行为。

## Summary Cache

Summary cache 是实验性功能，默认关闭。

```env
SUMMARY_CACHE=0
SUMMARY_CACHE_DIR=.token-slimmer-cache
SUMMARY_CACHE_MIN_TOKENS=1200
```

启用后，Token Slimmer 会对大型 tool/function 输出计算稳定 hash。如果同样的内容再次出现，可以把重复输出替换成一个较短的本地引用和确定性摘要。

Summary cache 的特点：

- 只在本地工作
- 不调用 LLM
- 默认只存摘要，不存完整原始工具输出
- 遇到疑似敏感内容会跳过缓存，例如 API key、bearer token、cookie、password、`.env` 风格 secret 和 private key
- 可能影响 agent 行为，启用前应使用真实工作流测试

## Benchmarks

Benchmark 离线运行，不需要 API keys。

```bash
npm run bench
npm run bench:corpus captures/
```

v0.5-beta balanced benchmark，来自本地 Hermes capture corpus：

```text
Corpus: 58 captured requests
```

| Variant | Mode | Summary cache | Original | Compressed | Saved | Saved % | Summary cache contribution |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| default | balanced | off | 1,550,698 | 1,197,640 | 353,058 | 22.8% | 0 |
| openai/hermes/cache 0 | balanced | off | 1,550,698 | 1,197,640 | 353,058 | 22.8% | 0 |
| openai/hermes/cache 1 | balanced | on | 1,550,698 | 1,088,875 | 461,823 | 29.8% | 302,956 |

同一 corpus 上的模式对比：

| Mode | Original | Compressed | Saved | Saved % | 建议用途 |
| --- | ---: | ---: | ---: | ---: | --- |
| safe | 1,550,698 | 1,542,375 | 8,323 | 0.5% | 最低风险 baseline |
| balanced | 1,550,698 | 1,197,640 | 353,058 | 22.8% | 推荐日常 agent 使用 |
| aggressive | 1,550,698 | 1,002,979 | 547,719 | 35.3% | 有损，先测试 |
| aggressive + `STRIP_TOOLS` | 1,550,698 | 712,629 | 838,069 | 54.0% | 实验性，可能影响 tool calling |

实际结果取决于 agent 流量形态、工具 schema 大小、历史消息长度和工具输出体量。这些数字是估算值，不应作为账单核算依据。

`bench:corpus` 支持文件、目录和 glob：

```bash
npm run bench:corpus captures/
npm run bench:corpus bench/samples/*.json
```

`eval:modes` 是 corpus mode comparison 的 alias：

```bash
npm run eval:modes bench/samples
```

## 兼容性

| Target | 状态 | 说明 |
| --- | --- | --- |
| OpenAI-compatible chat completions | 支持 | 主路径是 `/v1/chat/completions`。 |
| Streaming chat completions | 支持 | SSE chunks 透传，不解析。 |
| Unknown `/v1/*` paths | 转发 | 直接发给上游，不压缩。 |
| Hermes | 预期兼容 | 设计上关注重复 tools 和大型 tool outputs；仍建议用你的 provider 实测。 |
| OpenClaw | 预期兼容 | safe/balanced 应尽量保持 tool 行为；aggressive 需要谨慎测试。 |
| one-api | 预期兼容 | 把 one-api 配成 `UPSTREAM_URL` 使用。 |
| Claude Code / Cursor | 谨慎实验 | 行为取决于它们当前的 provider adapter 和 headers，不要假设完全兼容。 |

## 安全说明

- safe mode 是最低风险 baseline。
- balanced mode 推荐日常使用。
- aggressive mode 是有损模式，可能影响 agent 行为。
- `STRIP_TOOLS` 可能影响 tool calling。
- summary cache 是实验性功能，默认关闭，也可能影响 agent 行为。
- Streaming responses 会透传，不解析 chunks。
- 未知 `/v1/*` 路径会不压缩直接转发。
- Token 统计是估算值，用于观察和对比，不用于账单级核算。
- 压缩模式会改变请求内容，因此可能影响 provider-side prompt/cache behavior。
- Token X-Ray 本身只是观察功能，不添加 model-visible metadata。
- Hop-by-hop request headers 不会转发；安全的 custom provider headers 会保留。

## 配置

运行时配置加载优先级：

```text
defaults < config.local.json < environment variables
```

由环境变量设置的字段会在 dashboard 中显示为 locked，不能在那里编辑。

| Env var | Default | 说明 |
| --- | --- | --- |
| `PORT` | `3999` | 本地代理端口。 |
| `HOST` | `127.0.0.1` | 监听地址。只有明确要暴露代理时，例如 Docker 场景，才建议使用 `0.0.0.0`。 |
| `UPSTREAM_URL` | `http://127.0.0.1:3000` | 上游 OpenAI-compatible API base URL，不包含 `/v1`。 |
| `AUTH_MODE` | `forward_client_authorization` | `forward_client_authorization` 或 `configured_upstream_key`。 |
| `UPSTREAM_API_KEY` | empty | 可选上游 key。为空时转发客户端的 `Authorization`。 |
| `MODE` | `safe` | 压缩模式：`safe`、`balanced` 或 `aggressive`。 |
| `PROVIDER_PROFILE` | `generic` | token 估算 profile。 |
| `AGENT_PROFILE` | `generic` | agent-aware tool/function 输出压缩 profile。 |
| `CACHE_AWARE` | `0` | 更偏向上游 prompt/cache 稳定性，而不是最大压缩率。 |
| `SUMMARY_CACHE` | `0` | 实验性本地摘要缓存。默认关闭。 |
| `SUMMARY_CACHE_DIR` | `.token-slimmer-cache` | summary-only cache JSON 文件目录。 |
| `SUMMARY_CACHE_MIN_TOKENS` | `1200` | 工具输出达到多少估算 token 后才考虑 summary cache。 |
| `SLIM_TOOLS` | `1` | 启用工具 schema slimming。 |
| `COMPRESS_CONTENT` | `1` | 启用 tool/function output compression。safe mode 下只 minify JSON-looking output。 |
| `STRIP_TOOLS` | `0` | 只在 `MODE=aggressive` 下生效，并且必须显式设置为 `1`。 |
| `HEARTBEAT_INTERVAL` | `3` | aggressive tools stripping 下，每 N 次请求重新发送一次 tools。 |
| `CAPTURE_REQUESTS` | `0` | 保存传入的 JSON `/v1/*` 请求，用于本地 corpus benchmark。 |
| `CAPTURE_DIR` | `captures` | request capture 文件目录。 |

### URLs 和 Auth

| 项目 | 示例 | 含义 |
| --- | --- | --- |
| Client Base URL | `http://localhost:3999/v1` | 在 agent 或 OpenAI-compatible client 中配置这个地址，让它先请求 Token Slimmer。 |
| Token Slimmer listen URL | `http://localhost:3999` | 本地 proxy server 和 dashboard 的地址。 |
| Upstream URL | `http://127.0.0.1:3000` | Token Slimmer 真正转发到的 OpenAI-compatible API。 |

默认 auth 行为是 pass-through：Token Slimmer 不保存 API key，只把客户端的 `Authorization` header 转发给 upstream API。

如果设置 `AUTH_MODE=configured_upstream_key` 并配置了 `UPSTREAM_API_KEY`，Token Slimmer 会在转发 upstream 时用 `Authorization: Bearer <UPSTREAM_API_KEY>` 替换客户端传来的 `Authorization`。它也会移除客户端的 `x-api-key`，避免同时转发两份凭据。完整 key 永远不会从 `/api/config` 返回，也不会显示在 dashboard。

### Response Headers

对 chat completions 和 forwarded JSON `/v1/*` 请求，Token Slimmer 会添加：

| Header | 含义 |
| --- | --- |
| `x-token-slimmer-mode` | 当前模式。 |
| `x-token-slimmer-provider-profile` | 当前 provider token estimation profile。 |
| `x-token-slimmer-before-estimate` | 压缩前估算 prompt tokens。 |
| `x-token-slimmer-after-estimate` | 压缩后估算 prompt tokens。 |
| `x-token-slimmer-saved-estimate` | 估算 saved tokens。 |
| `x-token-slimmer-breakdown` | `schema`、`output` 和 `strip` savings breakdown。 |

日志示例：

```text
[token-slimmer] mode=balanced | POST /v1/chat/completions | before=1200 | after=900 | saved=300 (25.0%) | schema=180 | output=120 | strip=0
```

## Request Capture

开启 capture，从真实流量构建本地 benchmark corpus：

```bash
CAPTURE_REQUESTS=1 CAPTURE_DIR=captures npm start
```

Captured files 包含 method、path、headers 和 body。当 key 是 `authorization`、`api_key`、`token`、`password`、`cookie` 或 `x-api-key` 时，敏感 headers 和 body fields 会被 redacted。

不要提交本地 captures。它们已经被 `.gitignore` 忽略。

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

## 测试

```bash
npm run lint
npm test
```

测试覆盖 schema slimming、压缩模式边界、safe mode 行为、proxy forwarding、streaming passthrough、request stats、Settings Lite 配置更新、Token X-Ray breakdown、provider/agent profiles、summary cache 行为和 redaction。

## License

MIT
