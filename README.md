# Token Slimmer

LLM 请求压缩代理。放在 Hermes / Claude Code / 任何 OpenAI 兼容客户端前面，**省 50-60% 输入 token**，不改一行代码。

## 效果

| 项目 | 压缩前 | 压缩后 | 节省 |
|------|--------|--------|------|
| prompt tokens | 1190 | 490 | **58.8%** |
| tools schema | 完整描述 | 精简版 | ~9K/轮 |
| tool output | 原始JSON | 压缩版 | ~23K/轮 |

> 实际节省比例取决于工具数量和输出大小。消息越大省得越多。

## 一行启动

```bash
npm install && node server.js
```

默认监听 `http://localhost:3999`，转发到 `http://127.0.0.1:3000`（One-API）。

## 配置

环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `UPSTREAM_URL` | `http://127.0.0.1:3000` | 上游 API 地址 |
| `PORT` | `3999` | 本地监听端口 |
| `SLIM_TOOLS` | `1` | 精简 tools schema（关掉设 `0`） |
| `COMPRESS_CONTENT` | `1` | 压缩 tool output（关掉设 `0`） |

## 接入

把客户端的 `base_url` 改成 `http://localhost:3999` 即可：

### Hermes
```yaml
# config.yaml
providers:
  - name: slimmer
    api_key: 你的key
    base_url: http://localhost:3999
    api_mode: chat_completions
```

### Claude Code / 任何 OpenAI 客户端
```bash
export OPENAI_BASE_URL=http://localhost:3999/v1
```

## 压缩了什么

1. **Tools schema 瘦身**：删掉 `examples`、`default`、`title`、`$schema` 等冗余字段，description 截短
2. **Tool output 压缩**：
   - JSON → minify（去空格）
   - 代码 → 去ANSI码、合并空行、截断超长行、保留首尾
   - 日志 → 去分隔线、保留关键行
   - 散文 → 去多余空格、截断
3. **JSON 内部钻取**：解析 tool result 的 `output` 字段，分类压缩后再包装回去

## 安全性

- 纯文本变换，不改语义
- 不修改 system prompt（缓存前缀不变）
- 不修改 user message
- 不修改模型输出
- 所有操作可逆（压缩前可对比）

## Docker

```bash
docker run -d -p 3999:3999 -e UPSTREAM_URL=http://your-api:3000 token-slimmer
```

或者用 docker-compose.yml（见项目文件）。
