const express = require('express');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { Readable } = require('stream');
const {
  buildXRay,
  createState,
  emptyTokenBreakdown,
  estimateTokens,
  makeReportHeaders,
  modeConfigFromEnv,
  normalizeAgentProfile,
  processChatBody
} = require('./lib/slimmer');
const { normalizeProviderProfile } = require('./lib/tokenizer');

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length'
]);

const RESPONSE_SKIP_HEADERS = new Set([
  ...HOP_BY_HOP_HEADERS,
  'content-encoding',
  'content-length'
]);

const SENSITIVE_KEYS = new Set([
  'authorization',
  'api_key',
  'token',
  'password',
  'cookie',
  'x-api-key',
  'upstream_api_key'
]);

const DEFAULT_SETTINGS = {
  HOST: '127.0.0.1',
  PORT: 3999,
  UPSTREAM_URL: 'http://127.0.0.1:3000',
  MODE: 'safe',
  AUTH_MODE: 'forward_client_authorization',
  UPSTREAM_API_KEY: '',
  PROVIDER_PROFILE: 'generic',
  AGENT_PROFILE: 'generic',
  CAPTURE_REQUESTS: false,
  CAPTURE_DIR: 'captures',
  CACHE_AWARE: false,
  SUMMARY_CACHE: false,
  SUMMARY_CACHE_DIR: '.token-slimmer-cache',
  SUMMARY_CACHE_MIN_TOKENS: 1200,
  STRIP_TOOLS: false,
  HEARTBEAT_INTERVAL: 3,
  SLIM_TOOLS: true,
  COMPRESS_CONTENT: true
};

const EDITABLE_FIELDS = new Set([
  'UPSTREAM_URL',
  'MODE',
  'AUTH_MODE',
  'UPSTREAM_API_KEY',
  'PROVIDER_PROFILE',
  'AGENT_PROFILE',
  'CAPTURE_REQUESTS',
  'CACHE_AWARE',
  'SUMMARY_CACHE',
  'SUMMARY_CACHE_DIR',
  'SUMMARY_CACHE_MIN_TOKENS',
  'STRIP_TOOLS',
  'HEARTBEAT_INTERVAL'
]);

const ENV_LOCK_FIELDS = new Set([
  ...EDITABLE_FIELDS,
  'HOST',
  'PORT',
  'CAPTURE_DIR',
  'SLIM_TOOLS',
  'COMPRESS_CONTENT'
]);

function normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function targetUrl(upstreamUrl, originalUrl) {
  return normalizeBaseUrl(upstreamUrl) + originalUrl;
}

function envFlag(env, name, fallback) {
  if (env[name] == null || env[name] === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(env[name]).toLowerCase());
}

function parseBool(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeMode(value) {
  const mode = String(value || 'safe').toLowerCase();
  return ['safe', 'balanced', 'aggressive'].includes(mode) ? mode : 'safe';
}

function normalizeAuthMode(value) {
  const mode = String(value || 'forward_client_authorization').toLowerCase();
  return mode === 'configured_upstream_key' ? mode : 'forward_client_authorization';
}

function normalizeRuntimeProviderProfile(value) {
  return normalizeProviderProfile(value);
}

function normalizeRuntimeAgentProfile(value) {
  return normalizeAgentProfile(value);
}

function normalizeSettings(input) {
  const settings = { ...DEFAULT_SETTINGS, ...(input || {}) };
  settings.PORT = parsePositiveInt(settings.PORT, DEFAULT_SETTINGS.PORT);
  settings.MODE = normalizeMode(settings.MODE);
  settings.PROVIDER_PROFILE = normalizeRuntimeProviderProfile(settings.PROVIDER_PROFILE);
  settings.AGENT_PROFILE = normalizeRuntimeAgentProfile(settings.AGENT_PROFILE);
  settings.AUTH_MODE = normalizeAuthMode(settings.AUTH_MODE);
  settings.CAPTURE_REQUESTS = parseBool(settings.CAPTURE_REQUESTS, DEFAULT_SETTINGS.CAPTURE_REQUESTS);
  settings.CACHE_AWARE = parseBool(settings.CACHE_AWARE, DEFAULT_SETTINGS.CACHE_AWARE);
  settings.SUMMARY_CACHE = parseBool(settings.SUMMARY_CACHE, DEFAULT_SETTINGS.SUMMARY_CACHE);
  settings.SUMMARY_CACHE_MIN_TOKENS = parsePositiveInt(settings.SUMMARY_CACHE_MIN_TOKENS, DEFAULT_SETTINGS.SUMMARY_CACHE_MIN_TOKENS);
  settings.STRIP_TOOLS = parseBool(settings.STRIP_TOOLS, DEFAULT_SETTINGS.STRIP_TOOLS);
  if (settings.CACHE_AWARE) settings.STRIP_TOOLS = false;
  settings.HEARTBEAT_INTERVAL = parsePositiveInt(settings.HEARTBEAT_INTERVAL, DEFAULT_SETTINGS.HEARTBEAT_INTERVAL);
  settings.SLIM_TOOLS = parseBool(settings.SLIM_TOOLS, DEFAULT_SETTINGS.SLIM_TOOLS);
  settings.COMPRESS_CONTENT = parseBool(settings.COMPRESS_CONTENT, DEFAULT_SETTINGS.COMPRESS_CONTENT);
  settings.UPSTREAM_URL = normalizeBaseUrl(settings.UPSTREAM_URL || DEFAULT_SETTINGS.UPSTREAM_URL);
  settings.HOST = String(settings.HOST || DEFAULT_SETTINGS.HOST);
  settings.CAPTURE_DIR = String(settings.CAPTURE_DIR || DEFAULT_SETTINGS.CAPTURE_DIR);
  settings.SUMMARY_CACHE_DIR = String(settings.SUMMARY_CACHE_DIR || DEFAULT_SETTINGS.SUMMARY_CACHE_DIR);
  settings.UPSTREAM_API_KEY = String(settings.UPSTREAM_API_KEY || '');
  return settings;
}

function hasEnvOverride(env, field) {
  return Object.prototype.hasOwnProperty.call(env, field);
}

function envOverrides(env) {
  const out = {};
  for (const field of ENV_LOCK_FIELDS) {
    if (hasEnvOverride(env, field)) out[field] = env[field];
  }
  return out;
}

function lockMap(env) {
  const locks = {};
  for (const field of ENV_LOCK_FIELDS) {
    locks[field] = hasEnvOverride(env, field);
  }
  return locks;
}

function readLocalConfig(configPath) {
  try {
    if (!fsSync.existsSync(configPath)) return {};
    return JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.warn('[token-slimmer] failed to read config.local.json:', err.message);
    return {};
  }
}

async function writeLocalConfig(configPath, localConfig) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(localConfig, null, 2)}\n`);
}

function legacyOptionsToSettings(options) {
  const out = {};
  if (options.upstreamUrl != null) out.UPSTREAM_URL = options.upstreamUrl;
  if (options.port != null) out.PORT = options.port;
  if (options.host != null) out.HOST = options.host;
  if (options.captureRequests != null) out.CAPTURE_REQUESTS = options.captureRequests;
  if (options.captureDir != null) out.CAPTURE_DIR = options.captureDir;
  if (options.upstreamApiKey != null) out.UPSTREAM_API_KEY = options.upstreamApiKey;
  if (options.authMode != null) out.AUTH_MODE = options.authMode;
  if (options.modeConfig) {
    out.MODE = options.modeConfig.mode;
    out.STRIP_TOOLS = options.modeConfig.stripTools;
    out.HEARTBEAT_INTERVAL = options.modeConfig.heartbeatInterval;
    out.SLIM_TOOLS = options.modeConfig.slimTools;
    out.COMPRESS_CONTENT = options.modeConfig.compressContent;
    out.CACHE_AWARE = options.modeConfig.cacheAware;
    out.SUMMARY_CACHE = options.modeConfig.summaryCache;
    out.SUMMARY_CACHE_DIR = options.modeConfig.summaryCacheDir;
    out.SUMMARY_CACHE_MIN_TOKENS = options.modeConfig.summaryCacheMinTokens;
    out.PROVIDER_PROFILE = options.modeConfig.providerProfile;
    out.AGENT_PROFILE = options.modeConfig.agentProfile;
  }
  return out;
}

function settingsToModeEnv(settings) {
  return {
    MODE: settings.MODE,
    PROVIDER_PROFILE: settings.PROVIDER_PROFILE,
    AGENT_PROFILE: settings.AGENT_PROFILE,
    CACHE_AWARE: settings.CACHE_AWARE ? '1' : '0',
    SUMMARY_CACHE: settings.SUMMARY_CACHE ? '1' : '0',
    SUMMARY_CACHE_DIR: settings.SUMMARY_CACHE_DIR,
    SUMMARY_CACHE_MIN_TOKENS: String(settings.SUMMARY_CACHE_MIN_TOKENS),
    SLIM_TOOLS: settings.SLIM_TOOLS ? '1' : '0',
    COMPRESS_CONTENT: settings.COMPRESS_CONTENT ? '1' : '0',
    STRIP_TOOLS: settings.STRIP_TOOLS ? '1' : '0',
    HEARTBEAT_INTERVAL: String(settings.HEARTBEAT_INTERVAL)
  };
}

function createRuntimeConfig(options = {}) {
  const env = options.env || process.env;
  const configPath = options.configPath || path.join(__dirname, 'config.local.json');
  const rawLocalConfig = {
    ...readLocalConfig(configPath),
    ...(options.localConfig || {})
  };
  const localConfig = normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...rawLocalConfig
  });
  const settings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    ...localConfig,
    ...legacyOptionsToSettings(options),
    ...envOverrides(env)
  });
  const explicitAuthMode = hasEnvOverride(env, 'AUTH_MODE') ||
    Object.prototype.hasOwnProperty.call(rawLocalConfig, 'AUTH_MODE') ||
    options.authMode != null;

  if (!settings.UPSTREAM_API_KEY && !explicitAuthMode) {
    settings.AUTH_MODE = 'forward_client_authorization';
  }
  if (settings.UPSTREAM_API_KEY && !explicitAuthMode) {
    settings.AUTH_MODE = 'configured_upstream_key';
  }
  const explicitSlimTools = hasEnvOverride(env, 'SLIM_TOOLS') ||
    Object.prototype.hasOwnProperty.call(rawLocalConfig, 'SLIM_TOOLS') ||
    options.modeConfig?.slimTools != null;
  if (settings.CACHE_AWARE && !explicitSlimTools) {
    settings.SLIM_TOOLS = false;
  }
  if (settings.CACHE_AWARE) {
    settings.STRIP_TOOLS = false;
  }

  return {
    configPath,
    env,
    envLocks: lockMap(env),
    localConfig,
    settings,
    modeConfig: modeConfigFromEnv(settingsToModeEnv(settings)),
    state: options.state || createState(),
    stats: options.stats || createStats()
  };
}

function refreshModeConfig(config) {
  config.modeConfig = modeConfigFromEnv(settingsToModeEnv(config.settings));
}

function effectiveUpstreamApiKey(config) {
  return config.settings.AUTH_MODE === 'configured_upstream_key'
    ? config.settings.UPSTREAM_API_KEY
    : '';
}

function buildForwardHeaders(req, upstreamApiKey) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === 'accept-encoding') continue;
    if (value == null) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  headers['accept-encoding'] = 'identity';
  if (!headers['content-type'] && !headers['Content-Type'] && req.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (upstreamApiKey) {
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase();
      if (lower === 'authorization' || lower === 'x-api-key') {
        delete headers[key];
      }
    }
    headers.authorization = `Bearer ${upstreamApiKey}`;
  }
  return headers;
}

function copyResponseHeaders(upstreamRes, res) {
  upstreamRes.headers.forEach((value, key) => {
    if (!RESPONSE_SKIP_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });
}

function setReportHeaders(res, report) {
  for (const [key, value] of Object.entries(makeReportHeaders(report))) {
    res.setHeader(key, value);
  }
}

async function sendUpstreamResponse(upstreamRes, res, report, stream, onStreamDone) {
  copyResponseHeaders(upstreamRes, res);
  if (report) setReportHeaders(res, report);
  res.status(upstreamRes.status);

  if (stream && upstreamRes.body) {
    await new Promise((resolve, reject) => {
      const nodeStream = Readable.fromWeb(upstreamRes.body);
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        if (onStreamDone) onStreamDone(error || null);
        if (error) reject(error);
        else resolve();
      };
      nodeStream.on('error', finish);
      res.on('error', finish);
      res.on('finish', () => finish(null));
      res.on('close', () => finish(null));
      nodeStream.pipe(res);
    });
    return;
  }

  const text = await upstreamRes.text();
  res.send(text);
}

function logReport(report, req) {
  const saved = report.savedTokens;
  const pct = report.beforeTokens > 0 ? ((saved / report.beforeTokens) * 100).toFixed(1) : '0.0';
  const parts = [
    `mode=${report.mode}`,
    `${req.method} ${req.originalUrl}`,
    `before=${report.beforeTokens}`,
    `after=${report.afterTokens}`,
    `saved=${saved} (${pct}%)`,
    `schema=${report.breakdown.toolSchemaSlimming}`,
    `output=${report.breakdown.toolOutputCompression}`,
    `summaryCache=${report.breakdown.summaryCache || 0}`,
    `strip=${report.breakdown.toolsStripping}`
  ];
  if (report.toolsStripped) parts.push('tools=stripped');
  if (report.stream) parts.push('stream=true');
  console.log(`[token-slimmer] ${parts.join(' | ')}`);
}

function createStats() {
  return {
    recentRequests: [],
    totalRequests: 0,
    totalBeforeTokens: 0,
    totalAfterTokens: 0,
    totalSavedTokens: 0
  };
}

function savedPercent(saved, before) {
  return before > 0 ? Number(((saved / before) * 100).toFixed(1)) : 0;
}

function logRequestRecorded(record) {
  console.log(
    '[token-slimmer] request recorded' +
    ` | method=${record.method}` +
    ` | path=${record.path}` +
    ` | mode=${record.mode || 'unknown'}` +
    ` | stream=${record.stream}` +
    ` | before=${record.originalTokens}` +
    ` | after=${record.compressedTokens}` +
    ` | saved=${record.savedTokens}`
  );
}

function createRequestStatsRecord(stats, req, report) {
  const before = report?.beforeTokens || 0;
  const after = report?.afterTokens || 0;
  const saved = report?.savedTokens || 0;
  const record = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    mode: report?.mode || null,
    stream: report?.stream === true,
    originalTokens: before,
    compressedTokens: after,
    savedTokens: saved,
    savedPercent: savedPercent(saved, before),
    breakdown: {
      schemaSlimming: report?.breakdown?.toolSchemaSlimming || 0,
      contentCompression: report?.breakdown?.toolOutputCompression || 0,
      summaryCache: report?.breakdown?.summaryCache || 0,
      toolsStripping: report?.breakdown?.toolsStripping || 0
    },
    tokenBreakdownBefore: report?.xray?.tokenBreakdownBefore || emptyTokenBreakdown(),
    tokenBreakdownAfter: report?.xray?.tokenBreakdownAfter || emptyTokenBreakdown(),
    tokenBreakdownSaved: report?.xray?.tokenBreakdownSaved || emptyTokenBreakdown(),
    topTokenWasters: report?.xray?.topTokenWasters || [],
    toolsStripped: report?.toolsStripped === true,
    statusCode: null,
    error: null
  };

  stats.totalRequests += 1;
  stats.totalBeforeTokens += before;
  stats.totalAfterTokens += after;
  stats.totalSavedTokens += saved;
  stats.recentRequests.unshift(record);
  if (stats.recentRequests.length > 100) stats.recentRequests.length = 100;
  logRequestRecorded(record);
  return record;
}

function updateRequestStatsRecord(record, statusCode, error) {
  if (!record) return;
  if (statusCode != null) record.statusCode = statusCode;
  record.error = error || null;
}

function recordRequestStats(stats, req, report, statusCode, error) {
  const record = createRequestStatsRecord(stats, req, report);
  updateRequestStatsRecord(record, statusCode, error);
  return record;
}

function addBreakdown(target, source) {
  for (const [category, value] of Object.entries(source || {})) {
    target[category] = (target[category] || 0) + (value || 0);
  }
}

function largestBreakdownCategory(breakdown) {
  return Object.entries(breakdown || {})
    .sort((a, b) => b[1] - a[1])
    .map(([category, tokens]) => ({ category, tokens }))[0] || { category: null, tokens: 0 };
}

function aggregateXRay(records) {
  const before = emptyTokenBreakdown();
  const after = emptyTokenBreakdown();
  const saved = emptyTokenBreakdown();
  const wasters = [];
  for (const record of records) {
    addBreakdown(before, record.tokenBreakdownBefore);
    addBreakdown(after, record.tokenBreakdownAfter);
    addBreakdown(saved, record.tokenBreakdownSaved);
    for (const item of record.topTokenWasters || []) {
      wasters.push({
        ...item,
        requestPath: record.path,
        timestamp: record.timestamp
      });
    }
  }
  wasters.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
  const largestToolOutput = wasters.find(item => item.category === 'toolMessages' || item.category === 'functionMessages') || null;
  const largestToolsSchema = wasters.find(item => item.category === 'toolsSchema') || null;
  return {
    tokenBreakdownBefore: before,
    tokenBreakdownAfter: after,
    tokenBreakdownSaved: saved,
    biggestTokenCategory: largestBreakdownCategory(before),
    biggestSavedCategory: largestBreakdownCategory(saved),
    largestSingleToolOutput: largestToolOutput,
    largestToolsSchema,
    topTokenWasters: wasters.slice(0, 12)
  };
}

function statsPayload(stats) {
  return {
    recentRequests: stats.recentRequests,
    totalRequests: stats.totalRequests,
    totalEstimatedTokensBefore: stats.totalBeforeTokens,
    totalEstimatedTokensAfter: stats.totalAfterTokens,
    totalEstimatedSavedTokens: stats.totalSavedTokens,
    overallSavedPercent: savedPercent(stats.totalSavedTokens, stats.totalBeforeTokens),
    xray: aggregateXRay(stats.recentRequests)
  };
}

function apiKeyStatus(upstreamApiKey) {
  if (!upstreamApiKey) return { status: 'not_stored' };
  return {
    status: 'configured',
    last4: String(upstreamApiKey).slice(-4)
  };
}

function fieldPayload(field, value, config, extra = {}) {
  return {
    value,
    lockedByEnv: config.envLocks[field] === true,
    ...extra
  };
}

function configPayload(config) {
  const settings = config.settings;
  return {
    listenPort: settings.PORT,
    host: settings.HOST,
    upstreamUrl: settings.UPSTREAM_URL,
    mode: settings.MODE,
    providerProfile: settings.PROVIDER_PROFILE,
    agentProfile: settings.AGENT_PROFILE,
    captureEnabled: settings.CAPTURE_REQUESTS,
    captureDir: settings.CAPTURE_DIR,
    cacheAware: settings.CACHE_AWARE,
    summaryCacheEnabled: settings.SUMMARY_CACHE,
    summaryCacheDir: settings.SUMMARY_CACHE_DIR,
    summaryCacheMinTokens: settings.SUMMARY_CACHE_MIN_TOKENS,
    stripToolsEnabled: settings.STRIP_TOOLS,
    heartbeatInterval: settings.HEARTBEAT_INTERVAL,
    authMode: settings.AUTH_MODE,
    apiKey: apiKeyStatus(settings.UPSTREAM_API_KEY),
    envLocks: config.envLocks,
    configPath: config.configPath,
    fields: {
      HOST: fieldPayload('HOST', settings.HOST, config, { editable: false, restartRequired: true }),
      PORT: fieldPayload('PORT', settings.PORT, config, { editable: false, restartRequired: true }),
      UPSTREAM_URL: fieldPayload('UPSTREAM_URL', settings.UPSTREAM_URL, config, { editable: true }),
      MODE: fieldPayload('MODE', settings.MODE, config, { editable: true }),
      PROVIDER_PROFILE: fieldPayload('PROVIDER_PROFILE', settings.PROVIDER_PROFILE, config, { editable: true }),
      AGENT_PROFILE: fieldPayload('AGENT_PROFILE', settings.AGENT_PROFILE, config, { editable: true }),
      AUTH_MODE: fieldPayload('AUTH_MODE', settings.AUTH_MODE, config, { editable: true }),
      UPSTREAM_API_KEY: {
        ...apiKeyStatus(settings.UPSTREAM_API_KEY),
        lockedByEnv: config.envLocks.UPSTREAM_API_KEY === true,
        editable: true,
        writeOnly: true
      },
      CAPTURE_REQUESTS: fieldPayload('CAPTURE_REQUESTS', settings.CAPTURE_REQUESTS, config, { editable: true }),
      CACHE_AWARE: fieldPayload('CACHE_AWARE', settings.CACHE_AWARE, config, { editable: true }),
      SUMMARY_CACHE: fieldPayload('SUMMARY_CACHE', settings.SUMMARY_CACHE, config, { editable: true }),
      SUMMARY_CACHE_DIR: fieldPayload('SUMMARY_CACHE_DIR', settings.SUMMARY_CACHE_DIR, config, { editable: true }),
      SUMMARY_CACHE_MIN_TOKENS: fieldPayload('SUMMARY_CACHE_MIN_TOKENS', settings.SUMMARY_CACHE_MIN_TOKENS, config, { editable: true }),
      STRIP_TOOLS: fieldPayload('STRIP_TOOLS', settings.STRIP_TOOLS, config, { editable: true }),
      HEARTBEAT_INTERVAL: fieldPayload('HEARTBEAT_INTERVAL', settings.HEARTBEAT_INTERVAL, config, { editable: true })
    }
  };
}

function redactSensitive(value) {
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[REDACTED]')
      .replace(/\b(?:authorization|api_key|token|password|cookie|x-api-key)\s*[:=]\s*[^\s,;]+/gi, match => {
        const key = match.split(/[:=]/)[0];
        return `${key}=[REDACTED]`;
      });
  }
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== 'object') return value;

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = redactSensitive(child);
    }
  }
  return out;
}

function safeCapturePath(captureDir, req) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const route = req.originalUrl.split('?')[0].replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return path.join(captureDir, `${stamp}-${req.method}-${route || 'v1'}-${suffix}.json`);
}

async function captureRequest(req, body, captureDir) {
  if (!body || typeof body !== 'object') return;
  await fs.mkdir(captureDir, { recursive: true });
  const capture = {
    captured_at: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    headers: redactSensitive(req.headers),
    body: redactSensitive(body)
  };
  await fs.writeFile(safeCapturePath(captureDir, req), `${JSON.stringify(capture, null, 2)}\n`);
}

function settingsPatchFromBody(body) {
  const input = body || {};
  const patch = {};
  if (input.UPSTREAM_URL != null || input.upstreamUrl != null) {
    patch.UPSTREAM_URL = input.UPSTREAM_URL ?? input.upstreamUrl;
  }
  if (input.MODE != null || input.mode != null) patch.MODE = input.MODE ?? input.mode;
  if (input.PROVIDER_PROFILE != null || input.providerProfile != null) {
    patch.PROVIDER_PROFILE = input.PROVIDER_PROFILE ?? input.providerProfile;
  }
  if (input.AGENT_PROFILE != null || input.agentProfile != null) {
    patch.AGENT_PROFILE = input.AGENT_PROFILE ?? input.agentProfile;
  }
  if (input.AUTH_MODE != null || input.authMode != null) patch.AUTH_MODE = input.AUTH_MODE ?? input.authMode;
  if (input.CAPTURE_REQUESTS != null || input.captureEnabled != null) {
    patch.CAPTURE_REQUESTS = input.CAPTURE_REQUESTS ?? input.captureEnabled;
  }
  if (input.CACHE_AWARE != null || input.cacheAware != null) {
    patch.CACHE_AWARE = input.CACHE_AWARE ?? input.cacheAware;
  }
  if (input.SUMMARY_CACHE != null || input.summaryCacheEnabled != null) {
    patch.SUMMARY_CACHE = input.SUMMARY_CACHE ?? input.summaryCacheEnabled;
  }
  if (input.SUMMARY_CACHE_DIR != null || input.summaryCacheDir != null) {
    patch.SUMMARY_CACHE_DIR = input.SUMMARY_CACHE_DIR ?? input.summaryCacheDir;
  }
  if (input.SUMMARY_CACHE_MIN_TOKENS != null || input.summaryCacheMinTokens != null) {
    patch.SUMMARY_CACHE_MIN_TOKENS = input.SUMMARY_CACHE_MIN_TOKENS ?? input.summaryCacheMinTokens;
  }
  if (input.STRIP_TOOLS != null || input.stripToolsEnabled != null) {
    patch.STRIP_TOOLS = input.STRIP_TOOLS ?? input.stripToolsEnabled;
  }
  if (input.HEARTBEAT_INTERVAL != null || input.heartbeatInterval != null) {
    patch.HEARTBEAT_INTERVAL = input.HEARTBEAT_INTERVAL ?? input.heartbeatInterval;
  }
  if (input.UPSTREAM_API_KEY != null || input.upstreamApiKey != null) {
    const key = input.UPSTREAM_API_KEY ?? input.upstreamApiKey;
    if (String(key) !== '') patch.UPSTREAM_API_KEY = key;
  }
  if (input.clearUpstreamApiKey === true) patch.UPSTREAM_API_KEY = '';
  return patch;
}

function normalizeEditablePatch(patch, currentSettings) {
  const next = {};
  for (const [field, value] of Object.entries(patch)) {
    if (!EDITABLE_FIELDS.has(field)) continue;
    next[field] = value;
  }
  const merged = normalizeSettings({ ...currentSettings, ...next });
  const normalized = {};
  for (const field of Object.keys(next)) normalized[field] = merged[field];
  return normalized;
}

async function updateConfigFromBody(config, body) {
  const patch = normalizeEditablePatch(settingsPatchFromBody(body), config.settings);
  const locked = Object.keys(patch).filter(field => config.envLocks[field]);
  if (locked.length > 0) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Some fields are locked by environment variables.',
        lockedFields: locked
      }
    };
  }

  config.localConfig = normalizeSettings({ ...config.localConfig, ...patch });
  config.settings = normalizeSettings({ ...config.settings, ...patch });
  refreshModeConfig(config);

  const persisted = {};
  for (const field of Object.keys(DEFAULT_SETTINGS)) {
    if (config.localConfig[field] !== DEFAULT_SETTINGS[field]) {
      persisted[field] = config.localConfig[field];
    }
  }
  await writeLocalConfig(config.configPath, persisted);

  return {
    ok: true,
    status: 200,
    body: configPayload(config)
  };
}

function sanitizeError(message, config) {
  let text = String(message || 'Upstream test failed.');
  const key = config.settings.UPSTREAM_API_KEY;
  if (key) text = text.split(key).join('[REDACTED]');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [REDACTED]');
  return text;
}

async function testUpstream(config) {
  const url = `${normalizeBaseUrl(config.settings.UPSTREAM_URL)}/v1/models`;
  try {
    const upstreamRes = await fetch(url, {
      method: 'GET',
      headers: buildForwardHeaders({ headers: {}, body: undefined }, effectiveUpstreamApiKey(config))
    });
    return {
      ok: upstreamRes.ok,
      status: upstreamRes.status,
      error: upstreamRes.ok ? null : `Upstream returned HTTP ${upstreamRes.status}`
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      error: sanitizeError(err.message, config)
    };
  }
}

function basicReport(body, modeConfig) {
  const providerProfile = modeConfig.providerProfile || 'generic';
  const agentProfile = modeConfig.agentProfile || 'generic';
  const estimate = body && typeof body === 'object'
    ? estimateTokens(JSON.stringify(body), providerProfile)
    : 0;
  return {
    mode: modeConfig.mode,
    providerProfile,
    agentProfile,
    beforeTokens: estimate,
    afterTokens: estimate,
    savedTokens: 0,
    breakdown: {
      toolSchemaSlimming: 0,
      toolOutputCompression: 0,
      summaryCache: 0,
      toolsStripping: 0
    },
    toolsStripped: false,
    stream: body && typeof body === 'object' && body.stream === true
  };
}

function createApp(options = {}) {
  const app = express();
  const config = createRuntimeConfig(options);

  app.use(express.json({ limit: options.jsonLimit || '100mb' }));

  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  });

  app.get('/api/config', (req, res) => {
    res.json(configPayload(config));
  });

  app.post('/api/config', async (req, res) => {
    try {
      const result = await updateConfigFromBody(config, req.body);
      res.status(result.status).json(result.body);
    } catch (err) {
      res.status(400).json({ error: sanitizeError(err.message, config) });
    }
  });

  app.post('/api/config/test-upstream', async (req, res) => {
    const result = await testUpstream(config);
    res.status(result.ok ? 200 : 502).json(result);
  });

  app.get('/api/stats', (req, res) => {
    res.json(statsPayload(config.stats));
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      upstream: config.settings.UPSTREAM_URL,
      mode: config.modeConfig.mode,
      provider_profile: config.modeConfig.providerProfile,
      agent_profile: config.modeConfig.agentProfile,
      cache_aware: config.modeConfig.cacheAware,
      summary_cache: config.modeConfig.summaryCache,
      summary_cache_dir: config.modeConfig.summaryCacheDir,
      summary_cache_min_tokens: config.modeConfig.summaryCacheMinTokens,
      slim_tools: config.modeConfig.slimTools,
      compress_content: config.modeConfig.compressContent,
      strip_tools: config.modeConfig.stripTools,
      heartbeat_interval: config.modeConfig.heartbeatInterval,
      request_count: config.state.requestCount,
      tools_cached: !!config.state.cachedTools,
      tools_cache_tokens: config.state.cachedToolsTokens,
      capture_requests: config.settings.CAPTURE_REQUESTS,
      capture_dir: config.settings.CAPTURE_DIR,
      auth_mode: config.settings.AUTH_MODE
    });
  });

  app.all('/v1/*', async (req, res) => {
    const isChatCompletion = req.method === 'POST' && req.path === '/v1/chat/completions';
    let body = req.body;
    let report = null;
    let statsRecord = null;

    if (config.settings.CAPTURE_REQUESTS && body && typeof body === 'object') {
      try {
        await captureRequest(req, body, config.settings.CAPTURE_DIR);
      } catch (err) {
        console.warn('[token-slimmer] request capture failed:', sanitizeError(err.message, config));
      }
    }

    if (isChatCompletion && body && typeof body === 'object') {
      const processed = processChatBody(body, config.modeConfig, config.state);
      body = processed.body;
      report = processed.report;
      report.stream = body.stream === true;
    } else {
      report = basicReport(body, config.modeConfig);
    }
    report.xray = buildXRay(req.body, body, report.providerProfile);
    statsRecord = createRequestStatsRecord(config.stats, req, report);

    try {
      const method = req.method.toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD' && body !== undefined;
      const upstreamRes = await fetch(targetUrl(config.settings.UPSTREAM_URL, req.originalUrl), {
        method,
        headers: buildForwardHeaders(req, effectiveUpstreamApiKey(config)),
        body: hasBody ? JSON.stringify(body) : undefined
      });

      if (report) logReport(report, req);
      updateRequestStatsRecord(statsRecord, upstreamRes.status, null);
      await sendUpstreamResponse(upstreamRes, res, report, !!report?.stream, error => {
        updateRequestStatsRecord(statsRecord, upstreamRes.status, error ? sanitizeError(error.message, config) : null);
      });
    } catch (err) {
      const safeMessage = sanitizeError(err.message, config);
      console.error('[token-slimmer] proxy error:', safeMessage);
      updateRequestStatsRecord(statsRecord, 502, safeMessage);
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(502).json({
        error: {
          message: `Upstream request failed: ${safeMessage}`,
          type: 'token_slimmer_upstream_error'
        }
      });
    }
  });

  return app;
}

if (require.main === module) {
  const bootConfig = createRuntimeConfig();
  const app = createApp();
  app.listen(bootConfig.settings.PORT, bootConfig.settings.HOST, () => {
    console.log(`Token Slimmer proxy running on http://${bootConfig.settings.HOST}:${bootConfig.settings.PORT}`);
    console.log(`Upstream: ${bootConfig.settings.UPSTREAM_URL}`);
    console.log(`MODE=${bootConfig.modeConfig.mode}, PROVIDER_PROFILE=${bootConfig.modeConfig.providerProfile}, AGENT_PROFILE=${bootConfig.modeConfig.agentProfile}, SLIM_TOOLS=${bootConfig.modeConfig.slimTools}, COMPRESS_CONTENT=${bootConfig.modeConfig.compressContent}`);
    console.log(`CACHE_AWARE=${bootConfig.modeConfig.cacheAware}, STRIP_TOOLS=${bootConfig.modeConfig.stripTools}, HEARTBEAT_INTERVAL=${bootConfig.modeConfig.heartbeatInterval}`);
    console.log(`SUMMARY_CACHE=${bootConfig.modeConfig.summaryCache}, SUMMARY_CACHE_DIR=${bootConfig.modeConfig.summaryCacheDir}, SUMMARY_CACHE_MIN_TOKENS=${bootConfig.modeConfig.summaryCacheMinTokens}`);
    console.log(bootConfig.settings.AUTH_MODE === 'configured_upstream_key' ? 'Auth: using configured upstream key' : 'Auth: forwarding client Authorization header');
    if (bootConfig.settings.CAPTURE_REQUESTS) {
      console.log(`CAPTURE_REQUESTS=1, CAPTURE_DIR=${bootConfig.settings.CAPTURE_DIR}`);
    }
    if (bootConfig.modeConfig.mode === 'aggressive') {
      console.warn('[token-slimmer] aggressive mode is lossy and may affect agent tool-calling behavior.');
    }
  });
}

module.exports = {
  createApp,
  buildForwardHeaders,
  captureRequest,
  configPayload,
  createRuntimeConfig,
  createStats,
  redactSensitive,
  recordRequestStats,
  statsPayload,
  targetUrl,
  updateConfigFromBody
};
