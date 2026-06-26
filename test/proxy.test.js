const http = require('http');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { captureRequest, createApp, redactSensitive } = require('../server');
const { createState, modeConfigFromEnv } = require('../lib/slimmer');

function listen(serverOrApp) {
  return new Promise(resolve => {
    const server = serverOrApp.listen(0, () => resolve(server));
  });
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

function readJson(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data ? JSON.parse(data) : null));
  });
}

async function tempConfigPath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'token-slimmer-config-'));
  return {
    dir,
    file: path.join(dir, 'config.local.json')
  };
}

test('proxy forwards chat completions, custom headers, and token report headers', async () => {
  let upstreamBody;
  let upstreamHeader;
  const upstream = http.createServer(async (req, res) => {
    upstreamHeader = req.headers['x-provider-feature'];
    upstreamBody = await readJson(req);
    res.setHeader('content-type', 'application/json');
    res.setHeader('x-upstream-id', 'abc123');
    res.end(JSON.stringify({ id: 'chatcmpl-test', choices: [] }));
  });
  await listen(upstream);

  const app = createApp({
    upstreamUrl: `http://127.0.0.1:${upstream.address().port}`,
    modeConfig: modeConfigFromEnv({ MODE: 'safe' }),
    state: createState()
  });
  const proxy = await listen(app);

  const response = await fetch(`http://127.0.0.1:${proxy.address().port}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer test',
      'x-provider-feature': 'enabled'
    },
    body: JSON.stringify({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hello' }]
    })
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-upstream-id'), 'abc123');
  assert.equal(response.headers.get('x-token-slimmer-mode'), 'safe');
  assert.equal(response.headers.get('x-token-slimmer-provider-profile'), 'generic');
  assert.equal(upstreamHeader, 'enabled');
  assert.equal(upstreamBody.messages[0].content, 'hello');

  await close(proxy);
  await close(upstream);
});

test('/api/config redacts upstream API key and reports auth mode', async () => {
  const app = createApp({
    upstreamUrl: 'http://127.0.0.1:3000',
    modeConfig: modeConfigFromEnv({ MODE: 'aggressive', STRIP_TOOLS: '1' }),
    state: createState(),
    port: 4512,
    captureRequests: true,
    captureDir: 'captures-test',
    upstreamApiKey: 'sk-test-full-secret-1234'
  });
  const proxy = await listen(app);

  const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config`);
  const config = await response.json();
  const serialized = JSON.stringify(config);

  assert.equal(config.listenPort, 4512);
  assert.equal(config.mode, 'aggressive');
  assert.equal(config.providerProfile, 'generic');
  assert.equal(config.captureEnabled, true);
  assert.equal(config.stripToolsEnabled, true);
  assert.equal(config.authMode, 'configured_upstream_key');
  assert.deepEqual(config.apiKey, { status: 'configured', last4: '1234' });
  assert.equal(serialized.includes('sk-test-full-secret'), false);

  await close(proxy);
});

test('/api/config and /health include provider and agent profiles', async () => {
  const app = createApp({
    env: { PROVIDER_PROFILE: 'qwen', AGENT_PROFILE: 'hermes' },
    localConfig: { PROVIDER_PROFILE: 'anthropic', AGENT_PROFILE: 'codex' }
  });
  const proxy = await listen(app);

  const configResponse = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config`);
  const config = await configResponse.json();
  const healthResponse = await fetch(`http://127.0.0.1:${proxy.address().port}/health`);
  const health = await healthResponse.json();

  assert.equal(config.providerProfile, 'qwen');
  assert.equal(config.agentProfile, 'hermes');
  assert.equal(config.fields.PROVIDER_PROFILE.value, 'qwen');
  assert.equal(config.fields.PROVIDER_PROFILE.lockedByEnv, true);
  assert.equal(config.fields.AGENT_PROFILE.value, 'hermes');
  assert.equal(config.fields.AGENT_PROFILE.lockedByEnv, true);
  assert.equal(health.provider_profile, 'qwen');
  assert.equal(health.agent_profile, 'hermes');

  await close(proxy);
});

test('POST /api/config updates MODE immediately', async () => {
  const temp = await tempConfigPath();
  try {
    const app = createApp({
      configPath: temp.file,
      env: {},
      localConfig: { MODE: 'safe' }
    });
    const proxy = await listen(app);

    const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ MODE: 'balanced' })
    });
    const config = await response.json();
    const persisted = JSON.parse(await fs.readFile(temp.file, 'utf8'));

    assert.equal(response.status, 200);
    assert.equal(config.mode, 'balanced');
    assert.equal(persisted.MODE, 'balanced');

    await close(proxy);
  } finally {
    await fs.rm(temp.dir, { recursive: true, force: true });
  }
});

test('POST /api/config updates UPSTREAM_URL immediately', async () => {
  const temp = await tempConfigPath();
  try {
    const app = createApp({
      configPath: temp.file,
      env: {},
      localConfig: { UPSTREAM_URL: 'http://127.0.0.1:3000' }
    });
    const proxy = await listen(app);

    const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ UPSTREAM_URL: 'http://127.0.0.1:4444/' })
    });
    const config = await response.json();

    assert.equal(response.status, 200);
    assert.equal(config.upstreamUrl, 'http://127.0.0.1:4444');

    await close(proxy);
  } finally {
    await fs.rm(temp.dir, { recursive: true, force: true });
  }
});

test('blank API key in POST /api/config does not erase existing key', async () => {
  const temp = await tempConfigPath();
  try {
    const app = createApp({
      configPath: temp.file,
      env: {},
      localConfig: {
        AUTH_MODE: 'configured_upstream_key',
        UPSTREAM_API_KEY: 'sk-existing-1234'
      }
    });
    const proxy = await listen(app);

    const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ UPSTREAM_API_KEY: '' })
    });
    const config = await response.json();
    const serialized = JSON.stringify(config);

    assert.equal(response.status, 200);
    assert.deepEqual(config.apiKey, { status: 'configured', last4: '1234' });
    assert.equal(serialized.includes('sk-existing'), false);

    await close(proxy);
  } finally {
    await fs.rm(temp.dir, { recursive: true, force: true });
  }
});

test('clear upstream key removes configured key', async () => {
  const temp = await tempConfigPath();
  try {
    const app = createApp({
      configPath: temp.file,
      env: {},
      localConfig: {
        AUTH_MODE: 'configured_upstream_key',
        UPSTREAM_API_KEY: 'sk-existing-1234'
      }
    });
    const proxy = await listen(app);

    const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clearUpstreamApiKey: true })
    });
    const config = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(config.apiKey, { status: 'not_stored' });

    await close(proxy);
  } finally {
    await fs.rm(temp.dir, { recursive: true, force: true });
  }
});

test('env-locked fields cannot be overwritten', async () => {
  const temp = await tempConfigPath();
  try {
    const app = createApp({
      configPath: temp.file,
      env: { MODE: 'safe' },
      localConfig: { MODE: 'balanced' }
    });
    const proxy = await listen(app);

    const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ MODE: 'aggressive' })
    });
    const error = await response.json();
    const configResponse = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config`);
    const config = await configResponse.json();

    assert.equal(response.status, 409);
    assert.deepEqual(error.lockedFields, ['MODE']);
    assert.equal(config.mode, 'safe');
    assert.equal(config.fields.MODE.lockedByEnv, true);

    await close(proxy);
  } finally {
    await fs.rm(temp.dir, { recursive: true, force: true });
  }
});

test('test-upstream returns sanitized result', async () => {
  const temp = await tempConfigPath();
  try {
    const app = createApp({
      configPath: temp.file,
      env: {},
      localConfig: {
        UPSTREAM_URL: 'http://127.0.0.1:9',
        AUTH_MODE: 'configured_upstream_key',
        UPSTREAM_API_KEY: 'sk-test-secret-9999'
      }
    });
    const proxy = await listen(app);

    const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/config/test-upstream`, {
      method: 'POST'
    });
    const result = await response.json();
    const serialized = JSON.stringify(result);

    assert.equal(response.status, 502);
    assert.equal(result.ok, false);
    assert.equal(serialized.includes('sk-test-secret'), false);

    await close(proxy);
  } finally {
    await fs.rm(temp.dir, { recursive: true, force: true });
  }
});

test('/api/stats returns expected empty structure', async () => {
  const app = createApp({
    upstreamUrl: 'http://127.0.0.1:3000',
    modeConfig: modeConfigFromEnv({ MODE: 'safe' }),
    state: createState()
  });
  const proxy = await listen(app);

  const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/stats`);
  const stats = await response.json();

  assert.deepEqual(stats.recentRequests, []);
  assert.equal(stats.totalRequests, 0);
  assert.equal(stats.totalEstimatedTokensBefore, 0);
  assert.equal(stats.totalEstimatedTokensAfter, 0);
  assert.equal(stats.totalEstimatedSavedTokens, 0);
  assert.equal(stats.overallSavedPercent, 0);

  await close(proxy);
});

test('recent request stats are recorded after a proxied request', async () => {
  const upstream = http.createServer(async (req, res) => {
    await readJson(req);
    res.statusCode = 202;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });
  await listen(upstream);

  const app = createApp({
    upstreamUrl: `http://127.0.0.1:${upstream.address().port}`,
    modeConfig: modeConfigFromEnv({ MODE: 'safe' }),
    state: createState()
  });
  const proxy = await listen(app);

  await fetch(`http://127.0.0.1:${proxy.address().port}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hello' }]
    })
  });

  const statsResponse = await fetch(`http://127.0.0.1:${proxy.address().port}/api/stats`);
  const stats = await statsResponse.json();

  assert.equal(stats.totalRequests, 1);
  assert.equal(stats.totalEstimatedTokensBefore, stats.recentRequests[0].originalTokens);
  assert.equal(stats.recentRequests.length, 1);
  assert.equal(stats.recentRequests[0].method, 'POST');
  assert.equal(stats.recentRequests[0].path, '/v1/chat/completions');
  assert.equal(stats.recentRequests[0].mode, 'safe');
  assert.equal(stats.recentRequests[0].statusCode, 202);
  assert.equal(stats.recentRequests[0].error, null);
  assert.ok(stats.recentRequests[0].originalTokens > 0);
  assert.ok(stats.recentRequests[0].tokenBreakdownBefore.userMessages > 0);
  assert.ok(stats.recentRequests[0].tokenBreakdownAfter.userMessages > 0);
  assert.ok(Array.isArray(stats.recentRequests[0].topTokenWasters));
  assert.ok(stats.xray.tokenBreakdownBefore.userMessages > 0);

  await close(proxy);
  await close(upstream);
});

test('xray does not add metadata to forwarded upstream request body', async () => {
  let upstreamBody;
  const upstream = http.createServer(async (req, res) => {
    upstreamBody = await readJson(req);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });
  await listen(upstream);

  const app = createApp({
    upstreamUrl: `http://127.0.0.1:${upstream.address().port}`,
    modeConfig: modeConfigFromEnv({ MODE: 'safe', SLIM_TOOLS: '0', COMPRESS_CONTENT: '0' }),
    state: createState()
  });
  const proxy = await listen(app);

  const original = {
    model: 'gpt-test',
    messages: [{ role: 'user', content: 'hello' }]
  };
  await fetch(`http://127.0.0.1:${proxy.address().port}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(original)
  });

  assert.deepEqual(upstreamBody, original);

  await close(proxy);
  await close(upstream);
});

test('streaming request appears in /api/stats', async () => {
  const upstream = http.createServer(async (req, res) => {
    await readJson(req);
    res.statusCode = 200;
    res.setHeader('content-type', 'text/event-stream');
    res.write('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n');
    setTimeout(() => {
      res.end('data: [DONE]\n\n');
    }, 10);
  });
  await listen(upstream);

  const app = createApp({
    upstreamUrl: `http://127.0.0.1:${upstream.address().port}`,
    modeConfig: modeConfigFromEnv({ MODE: 'safe' }),
    state: createState()
  });
  const proxy = await listen(app);

  const response = await fetch(`http://127.0.0.1:${proxy.address().port}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-test',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }]
    })
  });
  await response.text();

  const statsResponse = await fetch(`http://127.0.0.1:${proxy.address().port}/api/stats`);
  const stats = await statsResponse.json();

  assert.equal(stats.totalRequests, 1);
  assert.equal(stats.recentRequests.length, 1);
  assert.equal(stats.recentRequests[0].stream, true);
  assert.equal(stats.recentRequests[0].path, '/v1/chat/completions');
  assert.equal(stats.recentRequests[0].statusCode, 200);
  assert.equal(stats.recentRequests[0].error, null);
  assert.ok(stats.recentRequests[0].originalTokens > 0);

  await close(proxy);
  await close(upstream);
});

test('configured upstream API key replaces client Authorization upstream', async () => {
  let upstreamAuth;
  let upstreamApiKey;
  const upstream = http.createServer(async (req, res) => {
    upstreamAuth = req.headers.authorization;
    upstreamApiKey = req.headers['x-api-key'];
    await readJson(req);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });
  await listen(upstream);

  const app = createApp({
    upstreamUrl: `http://127.0.0.1:${upstream.address().port}`,
    modeConfig: modeConfigFromEnv({ MODE: 'safe' }),
    state: createState(),
    upstreamApiKey: 'configured-secret'
  });
  const proxy = await listen(app);

  await fetch(`http://127.0.0.1:${proxy.address().port}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer client-secret',
      'x-api-key': 'client-api-key'
    },
    body: JSON.stringify({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hello' }]
    })
  });

  assert.equal(upstreamAuth, 'Bearer configured-secret');
  assert.equal(upstreamApiKey, undefined);

  await close(proxy);
  await close(upstream);
});

test('proxy forwards unknown /v1 paths without compression', async () => {
  let upstreamUrl;
  const upstream = http.createServer(async (req, res) => {
    upstreamUrl = req.url;
    const body = await readJson(req);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ received: body }));
  });
  await listen(upstream);

  const app = createApp({
    upstreamUrl: `http://127.0.0.1:${upstream.address().port}`,
    modeConfig: modeConfigFromEnv({ MODE: 'balanced' }),
    state: createState()
  });
  const proxy = await listen(app);

  const payload = { input: '  keep   spacing  ' };
  const response = await fetch(`http://127.0.0.1:${proxy.address().port}/v1/embeddings?api-version=test`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await response.json();

  assert.equal(upstreamUrl, '/v1/embeddings?api-version=test');
  assert.deepEqual(json.received, payload);
  assert.equal(response.headers.get('x-token-slimmer-saved-estimate'), '0');
  const statsResponse = await fetch(`http://127.0.0.1:${proxy.address().port}/api/stats`);
  const stats = await statsResponse.json();
  assert.equal(stats.totalRequests, 1);
  assert.equal(stats.recentRequests[0].path, '/v1/embeddings?api-version=test');
  assert.equal(stats.recentRequests[0].mode, 'balanced');
  assert.equal(stats.recentRequests[0].statusCode, 200);

  await close(proxy);
  await close(upstream);
});

test('streaming chat completions are proxied as streams with status and headers', async () => {
  const upstream = http.createServer(async (req, res) => {
    await readJson(req);
    res.statusCode = 201;
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('x-stream-id', 'stream-test');
    res.write('data: {"choices":[{"delta":{"content":"hel"}}]}\n\n');
    setTimeout(() => {
      res.end('data: [DONE]\n\n');
    }, 10);
  });
  await listen(upstream);

  const app = createApp({
    upstreamUrl: `http://127.0.0.1:${upstream.address().port}`,
    modeConfig: modeConfigFromEnv({ MODE: 'safe' }),
    state: createState()
  });
  const proxy = await listen(app);

  const response = await fetch(`http://127.0.0.1:${proxy.address().port}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-test',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }]
    })
  });
  const text = await response.text();

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('x-stream-id'), 'stream-test');
  assert.equal(response.headers.get('x-token-slimmer-mode'), 'safe');
  assert.match(text, /data: \{"choices"/);
  assert.match(text, /data: \[DONE\]/);

  await close(proxy);
  await close(upstream);
});

test('request capture redacts sensitive headers and body fields', async () => {
  const captureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'token-slimmer-capture-'));
  try {
    await captureRequest({
      method: 'POST',
      originalUrl: '/v1/chat/completions',
      headers: {
        authorization: 'Bearer secret',
        cookie: 'session=secret',
        'x-api-key': 'provider-secret',
        'x-provider-feature': 'enabled'
      }
    }, {
      model: 'gpt-test',
      api_key: 'body-secret',
      messages: [
        {
          role: 'user',
          content: 'hello',
          metadata: {
            token: 'nested-secret',
            password: 'nested-password'
          }
        }
      ]
    }, captureDir);

    const files = await fs.readdir(captureDir);
    assert.equal(files.length, 1);
    const saved = JSON.parse(await fs.readFile(path.join(captureDir, files[0]), 'utf8'));

    assert.equal(saved.headers.authorization, '[REDACTED]');
    assert.equal(saved.headers.cookie, '[REDACTED]');
    assert.equal(saved.headers['x-api-key'], '[REDACTED]');
    assert.equal(saved.headers['x-provider-feature'], 'enabled');
    assert.equal(saved.body.api_key, '[REDACTED]');
    assert.equal(saved.body.messages[0].metadata.token, '[REDACTED]');
    assert.equal(saved.body.messages[0].metadata.password, '[REDACTED]');
  } finally {
    await fs.rm(captureDir, { recursive: true, force: true });
  }
});

test('redaction preserves non-sensitive values', () => {
  assert.deepEqual(redactSensitive({ model: 'gpt-test', nested: { safe: true } }), {
    model: 'gpt-test',
    nested: { safe: true }
  });
});

test('README and dashboard examples do not reference 4001 or 4002', async () => {
  const readme = await fs.readFile(path.join(__dirname, '..', 'README.md'), 'utf8');
  const dashboard = await fs.readFile(path.join(__dirname, '..', 'public', 'dashboard.html'), 'utf8');
  assert.equal(/4001|4002/.test(readme), false);
  assert.equal(/4001|4002/.test(dashboard), false);
});
