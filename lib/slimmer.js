const VALID_MODES = new Set(['safe', 'balanced', 'aggressive']);
const REDUNDANT_SCHEMA_FIELDS = new Set([
  'examples',
  'example',
  'default',
  'title',
  '$schema',
  'markdownDescription',
  'deprecated'
]);

const XRAY_CATEGORIES = [
  'toolsSchema',
  'systemMessages',
  'userMessages',
  'assistantMessages',
  'toolMessages',
  'functionMessages',
  'otherMessages'
];

const PREVIEW_MAX = 180;

function createState() {
  return {
    cachedTools: null,
    cachedToolsTokens: 0,
    requestCount: 0
  };
}

function parseMode(value) {
  const mode = String(value || 'safe').toLowerCase();
  return VALID_MODES.has(mode) ? mode : 'safe';
}

function envFlag(env, name, fallback) {
  if (env[name] == null || env[name] === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(env[name]).toLowerCase());
}

function modeConfigFromEnv(env = process.env) {
  const mode = parseMode(env.MODE);
  const cacheAware = envFlag(env, 'CACHE_AWARE', false);
  const slimTools = envFlag(env, 'SLIM_TOOLS', !cacheAware);
  const compressContent = envFlag(env, 'COMPRESS_CONTENT', true);
  const stripTools = !cacheAware && mode === 'aggressive' && envFlag(env, 'STRIP_TOOLS', false);
  const heartbeatInterval = Math.max(1, Number.parseInt(env.HEARTBEAT_INTERVAL || '3', 10) || 3);

  return {
    mode,
    cacheAware,
    slimTools,
    compressContent,
    stripTools,
    heartbeatInterval
  };
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function estimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  return Math.ceil(cjk + (s.length - cjk) / 4);
}

function estimatePromptTokens(body) {
  return estimateTokens(JSON.stringify(body || {}));
}

function emptyTokenBreakdown() {
  return Object.fromEntries(XRAY_CATEGORIES.map(category => [category, 0]));
}

function redactPreviewText(text) {
  return String(text || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[REDACTED]')
    .replace(/("(?:authorization|api_key|token|password|cookie|x-api-key)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/\b(?:authorization|api_key|token|password|cookie|x-api-key)\s*[:=]\s*[^\s,;]+/gi, match => {
      const key = match.split(/[:=]/)[0];
      return `${key}=[REDACTED]`;
    });
}

function safePreview(value, max = PREVIEW_MAX) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  text = redactPreviewText(text).replace(/\s+/g, ' ').trim();
  if (text.length > max) return `${text.slice(0, max)}...[truncated]`;
  return text;
}

function categoryForRole(role) {
  switch (String(role || '').toLowerCase()) {
    case 'system': return 'systemMessages';
    case 'user': return 'userMessages';
    case 'assistant': return 'assistantMessages';
    case 'tool': return 'toolMessages';
    case 'function': return 'functionMessages';
    default: return 'otherMessages';
  }
}

function messageTokenValue(message) {
  return estimateTokens(JSON.stringify(message || {}));
}

function messageLabel(message, index) {
  const role = message?.role || 'unknown';
  const name = message?.name ? ` ${message.name}` : '';
  const toolCall = message?.tool_call_id ? ` ${message.tool_call_id}` : '';
  return `${role}${name}${toolCall} #${index + 1}`;
}

function tokenBreakdown(body) {
  const breakdown = emptyTokenBreakdown();
  if (!body || typeof body !== 'object') return breakdown;

  if (Array.isArray(body.tools)) {
    breakdown.toolsSchema = estimateTokens(JSON.stringify(body.tools));
  }

  if (Array.isArray(body.messages)) {
    for (const message of body.messages) {
      breakdown[categoryForRole(message?.role)] += messageTokenValue(message);
    }
  }

  return breakdown;
}

function breakdownSaved(before, after) {
  const saved = emptyTokenBreakdown();
  for (const category of XRAY_CATEGORIES) {
    saved[category] = Math.max(0, (before?.[category] || 0) - (after?.[category] || 0));
  }
  return saved;
}

function addTopCandidate(candidates, item) {
  if (!item || item.estimatedTokens <= 0) return;
  candidates.push({
    category: item.category,
    label: item.label,
    estimatedTokens: item.estimatedTokens,
    savedEstimatedTokens: Math.max(0, item.savedEstimatedTokens || 0),
    preview: safePreview(item.preview)
  });
}

function isJsonLike(text) {
  if (typeof text !== 'string') return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function contentPreview(message) {
  if (typeof message?.content === 'string') return message.content;
  return message || '';
}

function findAfterMessage(afterMessages, index) {
  return Array.isArray(afterMessages) ? afterMessages[index] : null;
}

function topTokenWasters(beforeBody, afterBody) {
  const candidates = [];
  const beforeTools = Array.isArray(beforeBody?.tools) ? beforeBody.tools : [];
  const afterTools = Array.isArray(afterBody?.tools) ? afterBody.tools : [];
  if (beforeTools.length > 0) {
    const beforeTokens = estimateTokens(JSON.stringify(beforeTools));
    const afterTokens = afterTools.length > 0 ? estimateTokens(JSON.stringify(afterTools)) : 0;
    addTopCandidate(candidates, {
      category: 'toolsSchema',
      label: `top-level tools (${beforeTools.length})`,
      estimatedTokens: beforeTokens,
      savedEstimatedTokens: beforeTokens - afterTokens,
      preview: beforeTools.map(tool => tool?.function?.name || tool?.name || tool?.type || 'tool').join(', ')
    });
  }

  const beforeMessages = Array.isArray(beforeBody?.messages) ? beforeBody.messages : [];
  const afterMessages = Array.isArray(afterBody?.messages) ? afterBody.messages : [];
  let largestToolOutput = null;
  let largestJsonToolResult = null;
  let largestAssistant = null;
  let largestUser = null;

  beforeMessages.forEach((message, index) => {
    const tokens = messageTokenValue(message);
    const afterTokens = messageTokenValue(findAfterMessage(afterMessages, index));
    const item = {
      estimatedTokens: tokens,
      savedEstimatedTokens: tokens - afterTokens,
      preview: contentPreview(message)
    };

    if (message?.role === 'tool' || message?.role === 'function') {
      const candidate = {
        ...item,
        category: message.role === 'tool' ? 'toolMessages' : 'functionMessages',
        label: `largest ${message.role} output ${messageLabel(message, index)}`
      };
      if (!largestToolOutput || candidate.estimatedTokens > largestToolOutput.estimatedTokens) {
        largestToolOutput = candidate;
      }
      if (typeof message.content === 'string' && isJsonLike(message.content)) {
        const jsonCandidate = {
          ...item,
          category: message.role === 'tool' ? 'toolMessages' : 'functionMessages',
          label: `largest JSON/tool result ${messageLabel(message, index)}`
        };
        if (!largestJsonToolResult || jsonCandidate.estimatedTokens > largestJsonToolResult.estimatedTokens) {
          largestJsonToolResult = jsonCandidate;
        }
      }
    } else if (message?.role === 'assistant') {
      const candidate = {
        ...item,
        category: 'assistantMessages',
        label: `largest assistant history ${messageLabel(message, index)}`
      };
      if (!largestAssistant || candidate.estimatedTokens > largestAssistant.estimatedTokens) {
        largestAssistant = candidate;
      }
    } else if (message?.role === 'user') {
      const candidate = {
        ...item,
        category: 'userMessages',
        label: `largest user message ${messageLabel(message, index)}`
      };
      if (!largestUser || candidate.estimatedTokens > largestUser.estimatedTokens) {
        largestUser = candidate;
      }
    }
  });

  [largestToolOutput, largestJsonToolResult, largestAssistant, largestUser].forEach(item => addTopCandidate(candidates, item));
  return candidates.sort((a, b) => b.estimatedTokens - a.estimatedTokens).slice(0, 8);
}

function buildXRay(beforeBody, afterBody) {
  const before = tokenBreakdown(beforeBody);
  const after = tokenBreakdown(afterBody);
  return {
    tokenBreakdownBefore: before,
    tokenBreakdownAfter: after,
    tokenBreakdownSaved: breakdownSaved(before, after),
    topTokenWasters: topTokenWasters(beforeBody, afterBody || beforeBody)
  };
}

function shortText(s, max) {
  if (typeof s !== 'string') return s;
  return s.length > max ? `${s.slice(0, max)}...[truncated]` : s;
}

function slimSchemaValue(value, mode, depth = 0) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => slimSchemaValue(item, mode, depth + 1));

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (REDUNDANT_SCHEMA_FIELDS.has(key)) continue;
    if (mode === 'aggressive' && key === 'description') {
      out[key] = shortText(child, depth <= 2 ? 160 : 80);
      continue;
    }
    out[key] = slimSchemaValue(child, mode, depth + 1);
  }
  return out;
}

function slimTools(tools, mode = 'safe') {
  if (!Array.isArray(tools)) return tools;
  return tools.map(tool => {
    const next = clone(tool);
    const fn = next.function || next;
    if (mode === 'aggressive' && fn.description) {
      fn.description = shortText(fn.description, 200);
    }
    if (fn.parameters) {
      fn.parameters = slimSchemaValue(fn.parameters, mode);
    }
    return next;
  });
}

function minifyJsonText(text) {
  if (typeof text !== 'string') return text;
  try {
    const minified = JSON.stringify(JSON.parse(text));
    return minified.length < text.length ? minified : text;
  } catch {
    return text;
  }
}

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, '');
}

function normalizeLines(text) {
  const lines = stripAnsi(text).replace(/\r\n/g, '\n').split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const out = [];
  let blank = false;
  for (const line of lines) {
    if (line.trim() === '') {
      if (!blank) out.push('');
      blank = true;
      continue;
    }
    blank = false;
    if (out.length && out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out;
}

function isImportantLine(line) {
  return /(error|warn|fail|exception|traceback|stack trace|timeout|denied|refused|enoent|eacces|syntaxerror|typeerror|referenceerror)/i.test(line) ||
    /^\s*at\s+\S+/.test(line) ||
    /\bFile\s+"[^"]+",\s+line\s+\d+/.test(line) ||
    /([A-Za-z]:\\|\/)[^\s:]+/.test(line) ||
    /^\s*[\w.-]+:\s+.+/.test(line);
}

function balancedTextCompression(text) {
  const lines = normalizeLines(text);
  if (lines.length <= 80 && lines.every(line => line.length <= 1200)) {
    return lines.join('\n');
  }

  const important = lines.filter(isImportantLine);
  const selected = [];
  const seen = new Set();
  const add = line => {
    const key = line;
    if (!seen.has(key)) {
      selected.push(line);
      seen.add(key);
    }
  };

  lines.slice(0, 30).forEach(add);
  important.slice(0, 80).forEach(add);
  lines.slice(-30).forEach(add);

  const omitted = Math.max(0, lines.length - selected.length);
  if (omitted > 0) {
    selected.splice(Math.min(30, selected.length), 0, `... [${omitted} lines omitted; important lines preserved]`);
  }

  return selected.map(line => line.length > 1600 ? `${line.slice(0, 1600)}...[line truncated]` : line).join('\n');
}

function aggressiveTextCompression(text) {
  const lines = normalizeLines(text)
    .filter(line => !/^[-=*#]{3,}$/.test(line.trim()))
    .map(line => line.length > 500 ? `${line.slice(0, 500)}...[line truncated]` : line);

  if (lines.length > 100) {
    const important = lines.filter(isImportantLine).slice(0, 40);
    return [
      ...lines.slice(0, 35),
      `... [${lines.length - 70} lines omitted by aggressive mode]`,
      ...important,
      ...lines.slice(-35)
    ].join('\n');
  }

  let textOut = lines.join('\n');
  if (textOut.length > 12000) {
    textOut = `${textOut.slice(0, 9000)}...[${textOut.length - 9000} chars omitted by aggressive mode]`;
  }
  return textOut;
}

function compressPlainText(text, mode) {
  const jsonMinified = minifyJsonText(text);
  if (jsonMinified !== text) return jsonMinified;
  if (mode === 'safe') return text;
  if (mode === 'balanced') return balancedTextCompression(text);
  return aggressiveTextCompression(text);
}

function compressParsedToolResult(value, mode) {
  if (Array.isArray(value)) {
    return value.map(item => compressParsedToolResult(item, mode));
  }
  if (!value || typeof value !== 'object') return value;

  const out = { ...value };
  for (const [key, child] of Object.entries(out)) {
    if (typeof child === 'string' && ['output', 'stdout', 'stderr', 'content', 'text', 'message'].includes(key)) {
      out[key] = compressPlainText(child, mode);
    } else if (child && typeof child === 'object') {
      out[key] = compressParsedToolResult(child, mode);
    }
  }
  return out;
}

function compressToolContent(content, mode) {
  if (typeof content !== 'string') return content;
  try {
    const parsed = JSON.parse(content);
    const compressed = compressParsedToolResult(parsed, mode);
    const serialized = JSON.stringify(compressed);
    return serialized.length < content.length ? serialized : content;
  } catch {
    return compressPlainText(content, mode);
  }
}

function processMessageContent(messages, mode, compressContent) {
  let saved = 0;
  if (!compressContent || !Array.isArray(messages)) return saved;

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    if (!['tool', 'function'].includes(msg.role)) continue;
    if (typeof msg.content !== 'string') continue;

    const before = estimateTokens(msg.content);
    const compressed = compressToolContent(msg.content, mode);
    if (compressed !== msg.content) {
      msg.content = compressed;
      const after = estimateTokens(msg.content);
      saved += Math.max(0, before - after);
    }
  }

  return saved;
}

function maybeUpdateToolsCache(body, state, mode) {
  if (!Array.isArray(body.tools) || body.tools.length === 0) return;
  const slimmed = slimTools(body.tools, mode);
  state.cachedTools = slimmed;
  state.cachedToolsTokens = estimateTokens(JSON.stringify(slimmed));
}

function shouldHeartbeat(state, heartbeatInterval) {
  state.requestCount += 1;
  return state.requestCount % heartbeatInterval === 1;
}

function processChatBody(inputBody, config = modeConfigFromEnv(), state = createState()) {
  const body = clone(inputBody || {});
  const beforeTokens = estimatePromptTokens(inputBody);
  const breakdown = {
    toolSchemaSlimming: 0,
    toolOutputCompression: 0,
    toolsStripping: 0
  };

  const hadTools = Array.isArray(body.tools) && body.tools.length > 0;
  if (hadTools && config.slimTools) {
    const before = estimateTokens(JSON.stringify(body.tools));
    body.tools = slimTools(body.tools, config.mode);
    const after = estimateTokens(JSON.stringify(body.tools));
    breakdown.toolSchemaSlimming = Math.max(0, before - after);
  }

  if (hadTools) {
    maybeUpdateToolsCache(body, state, config.mode);
  }

  breakdown.toolOutputCompression = processMessageContent(
    body.messages,
    config.mode,
    config.compressContent
  );

  let toolsStripped = false;
  if (config.mode === 'aggressive' && config.stripTools && hadTools && state.cachedTools) {
    if (shouldHeartbeat(state, config.heartbeatInterval)) {
      body.tools = state.cachedTools;
    } else {
      const beforeStrip = estimatePromptTokens(body);
      delete body.tools;
      delete body.tool_choice;
      const afterStrip = estimatePromptTokens(body);
      breakdown.toolsStripping = Math.max(0, beforeStrip - afterStrip);
      toolsStripped = true;
    }
  }

  const afterTokens = estimatePromptTokens(body);
  return {
    body,
    report: {
      mode: config.mode,
      beforeTokens,
      afterTokens,
      savedTokens: Math.max(0, beforeTokens - afterTokens),
      breakdown,
      toolsStripped,
      stream: body.stream === true
    }
  };
}

function makeReportHeaders(report) {
  if (!report) return {};
  return {
    'x-token-slimmer-mode': report.mode,
    'x-token-slimmer-before-estimate': String(report.beforeTokens),
    'x-token-slimmer-after-estimate': String(report.afterTokens),
    'x-token-slimmer-saved-estimate': String(report.savedTokens),
    'x-token-slimmer-breakdown': `schema=${report.breakdown.toolSchemaSlimming}; output=${report.breakdown.toolOutputCompression}; strip=${report.breakdown.toolsStripping}`
  };
}

module.exports = {
  REDUNDANT_SCHEMA_FIELDS,
  XRAY_CATEGORIES,
  buildXRay,
  createState,
  emptyTokenBreakdown,
  estimateTokens,
  estimatePromptTokens,
  makeReportHeaders,
  modeConfigFromEnv,
  parseMode,
  processChatBody,
  safePreview,
  slimSchemaValue,
  slimTools,
  tokenBreakdown,
  minifyJsonText,
  compressToolContent
};
