const express = require('express');
const app = express();

const UPSTREAM_URL = process.env.UPSTREAM_URL || 'http://127.0.0.1:3000';
const PORT = process.env.PORT || 3999;
const SLIM_TOOLS = process.env.SLIM_TOOLS !== '0';
const COMPRESS_CONTENT = process.env.COMPRESS_CONTENT !== '0';
const STRIP_TOOLS = process.env.STRIP_TOOLS !== '0';
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '3', 10);

app.use(express.json({ limit: '100mb' }));

// ====== TOOLS CACHE ======
let cachedTools = null;
let cachedToolsTokens = 0;
let requestCount = 0;

// ====== TOKEN ESTIMATION ======
function estimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  return Math.ceil(cjk * 1.0 + (s.length - cjk) / 4);
}

// ====== TOOLS SCHEMA SLIMMING ======
function shortText(s, max) {
  if (typeof s !== 'string') return s;
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function slimSchema(obj, depth) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(x => slimSchema(x, depth + 1));
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (['examples', 'example', 'default', 'title', '$schema', 'markdownDescription', 'deprecated'].includes(key)) continue;
    if (key === 'description') { out[key] = shortText(value, depth <= 2 ? 120 : 50); continue; }
    out[key] = slimSchema(value, depth + 1);
  }
  return out;
}

function slimTools(tools) {
  if (!Array.isArray(tools)) return tools;
  return tools.map(tool => {
    const newTool = JSON.parse(JSON.stringify(tool));
    const fn = newTool.function || newTool;
    if (fn.description) fn.description = shortText(fn.description, 120);
    if (fn.parameters) fn.parameters = slimSchema(fn.parameters);
    return newTool;
  });
}

// ====== CONTENT COMPRESSION ======
function minifyJson(text) {
  try { const p = JSON.parse(text); const m = JSON.stringify(p); return m.length < text.length ? m : text; } catch { return text; }
}

function compressCode(text) {
  let lines = text.split('\n');
  lines = lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, ''));
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length-1].trim() === '') lines.pop();
  const merged = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line.trim() === '') { blankRun++; if (blankRun > 1) continue; }
    else blankRun = 0;
    merged.push(line);
  }
  const clean = merged.filter(l => !/^[-=*#]{3,}$/.test(l.trim()));
  const deduped = [];
  for (const line of clean) {
    if (deduped.length > 0 && line === deduped[deduped.length - 1]) continue;
    deduped.push(line);
  }
  const truncated = deduped.map(l => l.length > 500 ? l.slice(0, 500) + '...[truncated]' : l);
  const meaningful = truncated.filter(l => {
    const t = l.trim();
    if (!t || /^[-=*#]{3,}$/.test(t) || /^[\d\s:|/-]+$/.test(t)) return false;
    return true;
  });
  if (meaningful.length > 100) {
    const head = meaningful.slice(0, 50);
    const tail = meaningful.slice(-30);
    return [...head, '... [' + (meaningful.length - 80) + ' lines omitted]', ...tail].join('\n');
  }
  return meaningful.join('\n');
}

function compressLog(text) {
  const lines = text.split('\n').filter(l => {
    const t = l.trim();
    if (!t) return false;
    if (/^[-=*#]{3,}$/.test(t)) return false;
    return true;
  });
  const keyLines = lines.filter(l => /(error|warn|fail|exception|traceback|timeout|denied|refused)/i.test(l));
  if (keyLines.length > 0 && keyLines.length <= lines.length * 0.3) {
    const head = lines.slice(0, 5);
    const tail = lines.slice(-5);
    return [...head, '... [' + (lines.length - 10) + ' lines filtered, ' + keyLines.length + ' key lines]', ...keyLines.slice(0, 20), ...tail].join('\n');
  }
  if (lines.length > 50) {
    return [...lines.slice(0, 20), '... [' + (lines.length - 40) + ' lines]', ...lines.slice(-20)].join('\n');
  }
  return lines.join('\n');
}

function compressProse(text) {
  let s = text.replace(/\x1b\[[0-9;]*m/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 2000) s = s.slice(0, 1500) + '... [' + (s.length - 1500) + ' more chars]';
  return s;
}

function classifyContent(text) {
  if (!text || text.length < 20) return 'skip';
  const s = text.slice(0, 2000);
  if (/^\[[\s\n]*\{/.test(s.trim())) return 'json';
  if (/^\{[\s\n]*"/.test(s.trim())) return 'json';
  if (/\n\s{2,}[\w.]/.test(s) && /[{}();]/.test(s) && !s.includes('\u3002')) return 'code';
  if (/\d{4}[-\/]\d{2}[-\/]\d{2}/.test(s) && /(error|warn|info|debug|trace)/i.test(s)) return 'log';
  if (/(Error|Traceback|at\s|File\s".*",\sline)/i.test(s)) return 'code';
  if (/[\u4e00-\u9fff]/.test(s) || /[.!?] [A-Z]/.test(s)) return 'prose';
  return 'code';
}

function compressContent(text) {
  const type = classifyContent(text);
  switch (type) {
    case 'json': return minifyJson(text);
    case 'code': return compressCode(text);
    case 'log':  return compressLog(text);
    case 'prose': return compressProse(text);
    default: return text;
  }
}

function compressInnerContent(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed.map(item => {
        if (item && typeof item === 'object' && item.output) {
          const compressed = compressContent(String(item.output));
          if (compressed !== String(item.output)) {
            return { ...item, output: compressed };
          }
        }
        return item;
      }));
    }
    if (parsed && typeof parsed === 'object' && parsed.output) {
      const compressed = compressContent(String(parsed.output));
      if (compressed !== String(parsed.output)) {
        return JSON.stringify({ ...parsed, output: compressed });
      }
    }
    return minifyJson(text);
  } catch {
    return compressContent(text);
  }
}

// ====== MESSAGE PROCESSING ======
function processMessages(messages) {
  let totalBefore = 0, totalAfter = 0;
  let toolsSlimmed = false;

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;

    if (SLIM_TOOLS && msg.role === 'assistant' && msg.tool_calls) {
      const before = estimateTokens(JSON.stringify(msg.tool_calls));
      msg.tool_calls = slimTools(msg.tool_calls);
      const after = estimateTokens(JSON.stringify(msg.tool_calls));
      totalBefore += before; totalAfter += after;
      if (before !== after) toolsSlimmed = true;
    }

    if (COMPRESS_CONTENT && msg.role === 'tool' && msg.content) {
      const before = estimateTokens(msg.content);
      const compressed = compressInnerContent(msg.content);
      if (compressed !== msg.content) {
        msg.content = compressed;
        const after = estimateTokens(msg.content);
        totalBefore += before; totalAfter += after;
      }
    }

    if (COMPRESS_CONTENT && msg.role === 'function' && msg.content) {
      const before = estimateTokens(msg.content);
      const compressed = compressInnerContent(msg.content);
      if (compressed !== msg.content) {
        msg.content = compressed;
        const after = estimateTokens(msg.content);
        totalBefore += before; totalAfter += after;
      }
    }
  }

  return { totalBefore, totalAfter, toolsSlimmed };
}

// ====== TOOLS CACHE MANAGEMENT ======
function updateToolsCache(tools) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) return;
  const slimmed = slimTools(tools);
  const tokens = estimateTokens(JSON.stringify(slimmed));
  cachedTools = slimmed;
  cachedToolsTokens = tokens;
  console.log('[' + new Date().toLocaleTimeString() + '] tools cached: ' + tokens + ' tok (' + tools.length + ' tools)');
}

function shouldSendHeartbeat() {
  requestCount++;
  return (requestCount % HEARTBEAT_INTERVAL === 1);
}

// ====== PROXY HANDLER ======
app.post('/v1/chat/completions', async (req, res) => {
  const body = JSON.parse(JSON.stringify(req.body));
  const messages = body.messages || [];

  // 1. Cache tools if present
  if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
    updateToolsCache(body.tools);
  }

  // 2. Compress messages
  const { totalBefore, totalAfter, toolsSlimmed } = processMessages(messages);

  // 3. Decide whether to strip tools
  let toolsStripped = false;
  let toolsRestoredTokens = 0;
  const hadTools = !!body.tools;

  if (STRIP_TOOLS && cachedTools && hadTools) {
    const isHeartbeat = shouldSendHeartbeat();
    if (isHeartbeat) {
      body.tools = cachedTools;
      toolsRestoredTokens = cachedToolsTokens;
      console.log('[' + new Date().toLocaleTimeString() + '] heartbeat #' + requestCount + ': tools sent (' + cachedToolsTokens + ' tok)');
    } else {
      delete body.tools;
      if (body.tool_choice) delete body.tool_choice;
      toolsStripped = true;
      toolsRestoredTokens = cachedToolsTokens;
      console.log('[' + new Date().toLocaleTimeString() + '] req #' + requestCount + ': tools stripped (saved ~' + cachedToolsTokens + ' tok)');
    }
  } else if (hadTools && !STRIP_TOOLS) {
    body.tools = slimTools(body.tools);
  }

  // 4. Forward to upstream
  try {
    const upstreamRes = await fetch(UPSTREAM_URL + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || ''
      },
      body: JSON.stringify({ ...body, messages })
    });

    const data = await upstreamRes.json();

    // 5. Adjust usage: add back cached tools tokens
    if (data.usage && toolsRestoredTokens > 0) {
      data.usage.prompt_tokens = (data.usage.prompt_tokens || 0) + toolsRestoredTokens;
    }

    // 6. Log savings
    const saved = totalBefore - totalAfter;
    const pct = totalBefore > 0 ? ((saved / totalBefore) * 100).toFixed(1) : '0.0';
    const toolsSaved = toolsStripped ? cachedToolsTokens : 0;
    const totalSaved = saved + toolsSaved;
    const inputTokens = data.usage?.prompt_tokens || '?';

    console.log(
      '[' + new Date().toLocaleTimeString() + '] saved ' + totalSaved + ' tok' +
      (saved > 0 ? ' (content:' + saved + ')' : '') +
      (toolsStripped ? ' (strip:' + toolsSaved + ')' : '') +
      ' | ' + messages.length + ' msgs | input=' + inputTokens
    );

    res.status(upstreamRes.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: { message: 'Upstream request failed: ' + err.message } });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    upstream: UPSTREAM_URL,
    slim_tools: SLIM_TOOLS,
    compress_content: COMPRESS_CONTENT,
    strip_tools: STRIP_TOOLS,
    heartbeat_interval: HEARTBEAT_INTERVAL,
    request_count: requestCount,
    tools_cached: !!cachedTools,
    tools_cache_tokens: cachedToolsTokens
  });
});

app.listen(PORT, () => {
  console.log('Token Slimmer proxy running on http://localhost:' + PORT);
  console.log('Upstream: ' + UPSTREAM_URL);
  console.log('SLIM_TOOLS=' + SLIM_TOOLS + ', COMPRESS_CONTENT=' + COMPRESS_CONTENT);
  console.log('STRIP_TOOLS=' + STRIP_TOOLS + ', HEARTBEAT_INTERVAL=' + HEARTBEAT_INTERVAL);
});
