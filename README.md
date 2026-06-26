# 🪢 Token Slimmer

> **LLM 请求压缩代理** — 放在任意 OpenAI 兼容客户端前面，**省 50-60% 输入 token**，不改一行代码。

```
客户端 → Token Slimmer → 上游 API (One-API / OpenAI / 任意)
         ↕ 省 58.8% tokens
```

---

## 为什么你需要这个

如果你在用 LLM agent（Claude Code、Hermes、Cursor 等），**90% 以上的 token 都花在输入上**——tools schema、tool output、system prompt 反复发送。每轮对话几千上万 token 就这么白白烧掉。

Token Slimmer 在你和 API 之间插一层，自动压缩这些冗余：

| 你关心什么 | Token Slimmer 做什么 |
|-----------|-------------------|
| 💰 **省钱** | 输入 token 省 50-60%，API 费用直接砍半 |
| ⚡ **更快** | 传输数据量减少，首 token 延迟降低 |
| 🔧 **零配置** | 改一行 base_url 就接入，不改客户端代码 |
| 🔒 **安全** | 纯文本变换，不改语义，不改输出 |

---

## 效果实测

| 项目 | 压缩前 | 压缩后 | 节省 |
|------|--------|--------|:----:|
| **Prompt tokens** | 1,190 | 490 | **58.8%** |
| **Tools schema（每轮）** | ~15K | ~6K | **~9K** |
| **Tool output（每轮）** | ~53K | ~30K | **~23K** |

> 消息越大省得越多。实测 39 条消息的对话从 53,008 → 29,885 tokens。

---

## 一行启动

```bash
npm install && node server.js
```

默认监听 http://localhost:3999，转发到 http://127.0.0.1:3000。

---

## 接入方式

把客户端的 base_url 改成 http://localhost:3999 即可：

### Hermes

```yaml
# config.yaml
providers:
  - name: slimmer
    api_key: 你的key
    base_url: http://localhost:3999
    api_mode: chat_completions
```

### Claude Code / 任意 OpenAI 客户端

```bash
export OPENAI_BASE_URL=http://localhost:3999/v1
```

### curl 测试

```bash
curl http://localhost:3999/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 你的key" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hello"}]}'
```

---

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| UPSTREAM_URL | http://127.0.0.1:3000 | 上游 API 地址 |
| PORT | 3999 | 本地监听端口 |
| SLIM_TOOLS | 1 | 精简 tools schema（关掉设 0） |
| COMPRESS_CONTENT | 1 | 压缩 tool output（关掉设 0） |
| STRIP_TOOLS | 1 | 剥离 tools 定义 + 心跳（关掉设 0） |
| HEARTBEAT_INTERVAL | 3 | 每 N 次请求发一次完整 tools |

---

## 压缩原理

### 1. Tools schema 瘦身
删掉 examples、default、title、$schema 等冗余字段，description 截短。每轮省 ~9K tokens。

### 2. Tool output 压缩
根据内容类型自动选择最优策略：

| 类型 | 策略 | 效果 |
|------|------|------|
| JSON | minify + 列式压缩 | 省 40-60% |
| 代码 | 去 ANSI 码、合并空行、截断超长行 | 省 30-50% |
| 日志 | 去分隔线、保留关键行 | 省 50-70% |
| 散文 | 去多余空格、截断 | 省 10-20% |

### 3. JSON 内部钻取
解析 tool result 的 output 字段，分类压缩后再包装回去。

### 4. Tools 剥离 + 心跳
首次请求发送完整 tools 定义，后续请求剥离，每 N 次发一次心跳刷新。每轮省 ~314 tokens。

---

## Docker

```bash
docker run -d -p 3999:3999 \
  -e UPSTREAM_URL=http://your-api:3000 \
  token-slimmer
```

或用项目自带的 docker-compose.yml。

---

## 和直接调 API 有什么区别？

```
直接调 API:  每轮 15K tokens → 15K tokens (100%)
用 Slimmer:  每轮 15K tokens →  6K tokens  (40%)
                             省 9K tokens  (60%)
```

数字不会骗人。省下来的 token 就是省下来的钱。

---

## 项目状态

✅ 可用 — 已在生产环境（Hermes + One-API）验证

---

MIT License · Made by [songchengtie](https://github.com/songchengtie)
