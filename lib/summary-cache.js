const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUMMARY_KEYS = ['error', 'message', 'status', 'path', 'name', 'type'];

function hashContent(content) {
  return crypto.createHash('sha256').update(String(content)).digest('hex');
}

function containsSensitiveContent(content) {
  const text = String(content || '');
  return /Bearer\s+[A-Za-z0-9._~+/=-]+/i.test(text) ||
    /\bsk-[A-Za-z0-9_-]{8,}\b/.test(text) ||
    /\b(?:api[_-]?key|token|password|cookie|secret|authorization)\s*[:=]\s*[^\s,;]+/i.test(text) ||
    /-----BEGIN (?:RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/.test(text) ||
    /^\s*[A-Z0-9_]*(?:API_KEY|TOKEN|PASSWORD|SECRET|COOKIE)\s*=/m.test(text);
}

function cachePath(cacheDir, hash) {
  return path.join(cacheDir, `${hash}.json`);
}

function nonEmptyLines(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim() !== '');
}

function uniqueLines(lines, limit) {
  const out = [];
  const seen = new Set();
  for (const line of lines) {
    const key = line.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

function likelyFilePath(lines) {
  const found = lines.find(line =>
    /\b(?:[A-Za-z]:\\|\/|\.\/|\.\.\/)[^\s:]+\.[A-Za-z0-9]{1,8}\b/.test(line) ||
    /\b[\w.-]+\/[\w./-]+\.[A-Za-z0-9]{1,8}\b/.test(line)
  );
  return found || null;
}

function summarizeCode(content) {
  const lines = nonEmptyLines(content);
  const imports = uniqueLines(lines.filter(line =>
    /^\s*(import|from\s+\S+\s+import|const\s+\{?[\w\s,]+\}?\s*=\s*require\()/.test(line)
  ), 12);
  const signatures = uniqueLines(lines.filter(line =>
    /^\s*(export\s+)?(async\s+)?function\s+\w+/.test(line) ||
    /^\s*(export\s+)?class\s+\w+/.test(line) ||
    /^\s*(public|private|protected|static|async)\s+.*\([^)]*\)/.test(line) ||
    /^\s*[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{/.test(line)
  ), 20);
  const exports = uniqueLines(lines.filter(line => /^\s*export\s+/.test(line) || /^\s*module\.exports/.test(line)), 12);
  const todos = uniqueLines(lines.filter(line => /\b(TODO|FIXME)\b/i.test(line)), 10);
  const errors = uniqueLines(lines.filter(line => /\b(throw|catch|except|error|fail|panic)\b/i.test(line)), 12);

  return [
    `line_count: ${lines.length}`,
    likelyFilePath(lines) ? `likely_path: ${likelyFilePath(lines)}` : null,
    imports.length ? `imports:\n${imports.map(line => `- ${line}`).join('\n')}` : null,
    signatures.length ? `classes_functions_signatures:\n${signatures.map(line => `- ${line}`).join('\n')}` : null,
    exports.length ? `exports:\n${exports.map(line => `- ${line}`).join('\n')}` : null,
    todos.length ? `todos_fixmes:\n${todos.map(line => `- ${line}`).join('\n')}` : null,
    errors.length ? `errors_throws_catches:\n${errors.map(line => `- ${line}`).join('\n')}` : null,
    `first_meaningful_lines:\n${lines.slice(0, 5).map(line => `- ${line}`).join('\n')}`,
    `last_meaningful_lines:\n${lines.slice(-5).map(line => `- ${line}`).join('\n')}`
  ].filter(Boolean).join('\n');
}

function summarizeShellLog(content) {
  const lines = nonEmptyLines(content);
  const commands = uniqueLines(lines.filter(line =>
    /^\s*(\$|>|PS>|npm |pnpm |yarn |node |python |py |git |docker |kubectl |make |cargo |go test|pytest|command:)/i.test(line)
  ), 8);
  const exitCodes = uniqueLines(lines.filter(line => /\b(exit code|exited with|return code|status code)\b\s*:?\s*-?\d+/i.test(line)), 8);
  const errors = uniqueLines(lines.filter(line => /\b(error|warn|fail|exception|traceback|stack trace|timeout|denied|refused|enoent|eacces)\b/i.test(line)), 20);
  const paths = uniqueLines(lines.filter(line => /([A-Za-z]:\\|\/)[^\s:]+/.test(line)), 16);
  const stack = uniqueLines(lines.filter(line =>
    /^\s*at\s+\S+/.test(line) || /\bFile\s+"[^"]+",\s+line\s+\d+/.test(line)
  ), 20);

  return [
    `line_count: ${lines.length}`,
    commands.length ? `commands:\n${commands.map(line => `- ${line}`).join('\n')}` : null,
    exitCodes.length ? `exit_codes:\n${exitCodes.map(line => `- ${line}`).join('\n')}` : null,
    errors.length ? `errors_warnings:\n${errors.map(line => `- ${line}`).join('\n')}` : null,
    paths.length ? `file_paths:\n${paths.map(line => `- ${line}`).join('\n')}` : null,
    stack.length ? `stack_traces:\n${stack.map(line => `- ${line}`).join('\n')}` : null,
    `first_useful_lines:\n${lines.slice(0, 5).map(line => `- ${line}`).join('\n')}`,
    `last_useful_lines:\n${lines.slice(-5).map(line => `- ${line}`).join('\n')}`
  ].filter(Boolean).join('\n');
}

function jsonShape(value, depth = 0) {
  if (depth > 2) return typeof value;
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      sample: value.length ? jsonShape(value[0], depth + 1) : null
    };
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    const important = {};
    for (const key of keys) {
      if (SUMMARY_KEYS.includes(key.toLowerCase())) important[key] = value[key];
    }
    return {
      type: 'object',
      keys: keys.slice(0, 40),
      important
    };
  }
  return typeof value;
}

function summarizeJson(content) {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(jsonShape(parsed), null, 2);
  } catch {
    return summarizeCode(content);
  }
}

function summarizeToolOutput(content, category) {
  if (category === 'json') return summarizeJson(content);
  if (category === 'shell' || category === 'log') return summarizeShellLog(content);
  return summarizeCode(content);
}

function isCacheCandidate(category) {
  return ['json', 'shell', 'log', 'code', 'file', 'diff'].includes(category);
}

function cachedReference(hash, originalEstimatedTokens, summary) {
  return [
    '[Token Slimmer cached repeated tool output]',
    `hash: ${hash}`,
    `original_estimated_tokens: ${originalEstimatedTokens}`,
    'summary:',
    summary
  ].join('\n');
}

function applySummaryCache(content, options) {
  const {
    enabled,
    cacheDir,
    minTokens,
    originalEstimatedTokens,
    category
  } = options || {};

  if (!enabled || typeof content !== 'string') return { content, status: 'disabled' };
  if (!isCacheCandidate(category)) return { content, status: 'not_candidate' };
  if ((originalEstimatedTokens || 0) < minTokens) return { content, status: 'too_small' };
  if (containsSensitiveContent(content)) return { content, status: 'sensitive' };

  const hash = hashContent(content);
  const summary = summarizeToolOutput(content, category);
  const file = cachePath(cacheDir, hash);
  fs.mkdirSync(cacheDir, { recursive: true });

  if (fs.existsSync(file)) {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      content: cachedReference(hash, record.originalEstimatedTokens || originalEstimatedTokens, record.summary || summary),
      hash,
      summary: record.summary || summary,
      status: 'hit'
    };
  }

  fs.writeFileSync(file, `${JSON.stringify({
    hash,
    category,
    originalEstimatedTokens,
    summary,
    createdAt: new Date().toISOString()
  }, null, 2)}\n`);
  return { content, hash, summary, status: 'stored' };
}

module.exports = {
  applySummaryCache,
  containsSensitiveContent,
  hashContent,
  summarizeToolOutput
};
