const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildXRay,
  classifyToolOutput,
  compressToolContent,
  createState,
  minifyJsonText,
  modeConfigFromEnv,
  normalizeAgentProfile,
  processChatBody,
  safePreview,
  tokenBreakdown,
  slimTools
} = require('../lib/slimmer');
const {
  estimateTokens,
  normalizeProviderProfile
} = require('../lib/tokenizer');
const {
  summarizeToolOutput
} = require('../lib/summary-cache');

function sampleTool(description = 'Search files in the current workspace.') {
  return {
    type: 'function',
    function: {
      name: 'search_files',
      description,
      parameters: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'SearchFiles',
        type: 'object',
        properties: {
          query: {
            type: 'string',
            title: 'Query',
            default: '',
            examples: ['token slimmer'],
            markdownDescription: 'Search query.'
          }
        },
        required: ['query'],
        deprecated: false
      }
    }
  };
}

test('safe schema slimming removes redundant fields and keeps descriptions intact', () => {
  const [tool] = slimTools([sampleTool()], 'safe');
  const params = tool.function.parameters;

  assert.equal(params.$schema, undefined);
  assert.equal(params.title, undefined);
  assert.equal(params.properties.query.default, undefined);
  assert.equal(params.properties.query.examples, undefined);
  assert.equal(params.properties.query.markdownDescription, undefined);
  assert.equal(tool.function.description, 'Search files in the current workspace.');
});

test('json minification keeps semantic content', () => {
  assert.equal(minifyJsonText('{\n  "ok": true,\n  "items": [1, 2]\n}'), '{"ok":true,"items":[1,2]}');
});

test('balanced compression preserves errors, paths, stack traces, and command-like output', () => {
  const noisyLines = Array.from({ length: 140 }, (_, i) => `info line ${i}`);
  const input = [
    '$ npm test',
    'Error: failed to open C:\\repo\\src\\index.js',
    '    at readFile (C:\\repo\\src\\index.js:10:3)',
    ...noisyLines,
    'exit code: 1'
  ].join('\n');

  const out = compressToolContent(input, 'balanced');
  assert.match(out, /Error: failed/);
  assert.match(out, /C:\\repo\\src\\index\.js/);
  assert.match(out, /at readFile/);
  assert.match(out, /exit code: 1/);
  assert.ok(out.length < input.length);
});

test('aggressive compression can be lossy', () => {
  const input = Array.from({ length: 150 }, (_, i) => `line ${i} ${'x'.repeat(80)}`).join('\n');
  const out = compressToolContent(input, 'aggressive');
  assert.match(out, /aggressive mode/);
  assert.ok(out.length < input.length);
});

test('safe mode is default and never strips tools', () => {
  const config = modeConfigFromEnv({});
  const state = createState();
  const result = processChatBody({
    model: 'gpt-test',
    messages: [{ role: 'user', content: 'hello' }],
    tools: [sampleTool()]
  }, config, state);

  assert.equal(config.mode, 'safe');
  assert.equal(config.providerProfile, 'generic');
  assert.ok(result.body.tools);
  assert.equal(result.report.toolsStripped, false);
});

test('invalid provider profile falls back to generic', () => {
  assert.equal(normalizeProviderProfile('unknown-provider'), 'generic');
  assert.equal(modeConfigFromEnv({ PROVIDER_PROFILE: 'unknown-provider' }).providerProfile, 'generic');
});

test('invalid agent profile falls back to generic', () => {
  assert.equal(normalizeAgentProfile('unknown-agent'), 'generic');
  assert.equal(modeConfigFromEnv({ AGENT_PROFILE: 'unknown-agent' }).agentProfile, 'generic');
});

test('provider profile affects token estimates', () => {
  const text = 'hello world '.repeat(200);
  const generic = estimateTokens(text, 'generic');
  const qwen = estimateTokens(text, 'qwen');
  const result = processChatBody({
    model: 'gpt-test',
    messages: [{ role: 'user', content: text }]
  }, modeConfigFromEnv({ PROVIDER_PROFILE: 'qwen' }), createState());

  assert.ok(qwen > generic);
  assert.equal(result.report.providerProfile, 'qwen');
  assert.ok(result.report.beforeTokens > processChatBody({
    model: 'gpt-test',
    messages: [{ role: 'user', content: text }]
  }, modeConfigFromEnv({}), createState()).report.beforeTokens);
});

test('tool output classifier detects common agent output types', () => {
  assert.equal(classifyToolOutput('{"ok":true,"items":[1,2]}'), 'json');
  assert.equal(classifyToolOutput('diff --git a/a.js b/a.js\n@@ -1 +1 @@\n-old\n+new'), 'diff');
  assert.equal(classifyToolOutput('$ npm test\nError: failed\nexit code: 1'), 'shell');
});

test('tool output classifier does not treat markdown bullet lists as diffs', () => {
  const markdown = [
    '# Token Slimmer',
    '',
    '- safe mode',
    '- balanced mode',
    '- aggressive mode',
    '',
    '---',
    '',
    '- another bullet'
  ].join('\n');

  assert.notEqual(classifyToolOutput(markdown), 'diff');
});

test('agent diff compression preserves file names, hunk headers, and changed lines', () => {
  const input = [
    'diff --git a/src/app.js b/src/app.js',
    'index 123..456 100644',
    '--- a/src/app.js',
    '+++ b/src/app.js',
    '@@ -1,120 +1,120 @@',
    ...Array.from({ length: 80 }, (_, i) => ` unchanged context ${i}`),
    '-const oldValue = 1;',
    '+const newValue = 2;',
    ...Array.from({ length: 80 }, (_, i) => ` more context ${i}`)
  ].join('\n');
  const out = compressToolContent(input, 'balanced', 'codex');

  assert.match(out, /diff --git a\/src\/app\.js b\/src\/app\.js/);
  assert.match(out, /@@ -1,120 \+1,120 @@/);
  assert.match(out, /-const oldValue = 1;/);
  assert.match(out, /\+const newValue = 2;/);
  assert.ok(out.length < input.length);
});

test('agent shell compression preserves errors, paths, stack traces, commands, and exit code', () => {
  const input = [
    '$ npm test',
    ...Array.from({ length: 90 }, (_, i) => `info line ${i}`),
    'Error: failed to load C:\\repo\\src\\index.js',
    '    at run (C:\\repo\\src\\index.js:42:7)',
    'Traceback (most recent call last):',
    'File "C:/repo/script.py", line 12, in main',
    'exit code: 1',
    ...Array.from({ length: 90 }, (_, i) => `tail noise ${i}`)
  ].join('\n');
  const out = compressToolContent(input, 'balanced', 'hermes');

  assert.match(out, /\$ npm test/);
  assert.match(out, /Error: failed/);
  assert.match(out, /C:\\repo\\src\\index\.js/);
  assert.match(out, /at run/);
  assert.match(out, /File "C:\/repo\/script\.py", line 12/);
  assert.match(out, /exit code: 1/);
  assert.ok(out.length < input.length);
});

test('agent code compression preserves imports, signatures, TODOs, and error lines', () => {
  const input = [
    "import fs from 'fs';",
    'export function parseConfig(input) {',
    '  // TODO: validate schema',
    '  if (!input) throw new Error("missing input");',
    '}',
    'class Runner {',
    '  run() { return parseConfig({}); }',
    '}',
    ...Array.from({ length: 180 }, (_, i) => `const filler${i} = ${i};`)
  ].join('\n');
  const out = compressToolContent(input, 'balanced', 'codex');

  assert.match(out, /import fs from 'fs'/);
  assert.match(out, /export function parseConfig/);
  assert.match(out, /TODO/);
  assert.match(out, /throw new Error/);
  assert.match(out, /class Runner/);
  assert.ok(out.length < input.length);
});

test('hermes balanced compression is not weaker than generic for large file-like outputs', () => {
  const output = [
    ...Array.from({ length: 220 }, (_, i) => `/mnt/c/Users/27666/token-slimmer/src/file-${i}.js`),
    "import fs from 'fs';",
    'export function loadConfig() { return fs.readFileSync("config.json", "utf8"); }',
    ...Array.from({ length: 220 }, (_, i) => `/mnt/c/Users/27666/token-slimmer/test/file-${i}.test.js`)
  ].join('\n');
  const content = JSON.stringify({ output, exit_code: 0, error: null });
  const generic = compressToolContent(content, 'balanced', 'generic');
  const hermes = compressToolContent(content, 'balanced', 'hermes');

  assert.ok(hermes.length <= generic.length);
});

test('summary cache replaces repeated large tool output on second occurrence when enabled', () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-slimmer-summary-cache-'));
  try {
    const content = [
      "import fs from 'fs';",
      'export function readConfig(path) {',
      '  if (!path) throw new Error("missing path");',
      '  return fs.readFileSync(path, "utf8");',
      '}',
      ...Array.from({ length: 140 }, (_, i) => `function helper${i}() { return ${i}; }`)
    ].join('\n');
    const body = {
      model: 'gpt-test',
      messages: [{ role: 'tool', content }]
    };
    const config = modeConfigFromEnv({
      MODE: 'safe',
      SUMMARY_CACHE: '1',
      SUMMARY_CACHE_DIR: cacheDir,
      SUMMARY_CACHE_MIN_TOKENS: '10'
    });

    const first = processChatBody(body, config, createState());
    const second = processChatBody(body, config, createState());

    assert.equal(first.body.messages[0].content, content);
    assert.match(second.body.messages[0].content, /\[Token Slimmer cached repeated tool output\]/);
    assert.match(second.body.messages[0].content, /summary:/);
    assert.ok(second.report.breakdown.summaryCache > 0);
    const files = fs.readdirSync(cacheDir);
    assert.equal(files.length, 1);
    const cached = JSON.parse(fs.readFileSync(path.join(cacheDir, files[0]), 'utf8'));
    assert.equal(cached.rawContent, undefined);
    assert.ok(JSON.stringify(cached).length < content.length);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('summary cache disabled preserves existing behavior', () => {
  const content = Array.from({ length: 120 }, (_, i) => `function repeated${i}() { return ${i}; }`).join('\n');
  const body = {
    model: 'gpt-test',
    messages: [{ role: 'tool', content }]
  };
  const result = processChatBody(body, modeConfigFromEnv({
    MODE: 'safe',
    SUMMARY_CACHE: '0',
    SUMMARY_CACHE_MIN_TOKENS: '10'
  }), createState());

  assert.equal(result.body.messages[0].content, content);
  assert.equal(result.report.breakdown.summaryCache, 0);
});

test('summary cache does not cache sensitive content', () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-slimmer-sensitive-cache-'));
  try {
    const content = [
      '$ node deploy.js',
      'API_KEY=sk-secretsecretsecret',
      'Error: failed to deploy',
      'exit code: 1',
      ...Array.from({ length: 120 }, (_, i) => `log line ${i}`)
    ].join('\n');
    const body = {
      model: 'gpt-test',
      messages: [{ role: 'tool', content }]
    };
    const config = modeConfigFromEnv({
      MODE: 'safe',
      SUMMARY_CACHE: '1',
      SUMMARY_CACHE_DIR: cacheDir,
      SUMMARY_CACHE_MIN_TOKENS: '10'
    });

    const first = processChatBody(body, config, createState());
    const second = processChatBody(body, config, createState());

    assert.equal(first.body.messages[0].content, content);
    assert.equal(second.body.messages[0].content, content);
    assert.equal(fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir).length : 0, 0);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});

test('file/code summary includes imports and functions', () => {
  const summary = summarizeToolOutput([
    "import path from 'path';",
    'export function loadFile(name) {',
    '  return path.resolve(name);',
    '}',
    'class Reader {}'
  ].join('\n'), 'code');

  assert.match(summary, /imports:/);
  assert.match(summary, /import path from 'path'/);
  assert.match(summary, /classes_functions_signatures:/);
  assert.match(summary, /export function loadFile/);
});

test('shell/log summary includes errors and exit code', () => {
  const summary = summarizeToolOutput([
    '$ npm test',
    'Error: failed at C:\\repo\\test.js',
    '    at run (C:\\repo\\test.js:10:2)',
    'exit code: 1'
  ].join('\n'), 'shell');

  assert.match(summary, /commands:/);
  assert.match(summary, /errors_warnings:/);
  assert.match(summary, /exit_codes:/);
  assert.match(summary, /exit code: 1/);
});

test('balanced mode does not strip tools', () => {
  const config = modeConfigFromEnv({ MODE: 'balanced', STRIP_TOOLS: '1' });
  const state = createState();
  const result = processChatBody({
    model: 'gpt-test',
    messages: [{ role: 'user', content: 'hello' }],
    tools: [sampleTool()]
  }, config, state);

  assert.ok(result.body.tools);
  assert.equal(result.report.breakdown.toolsStripping, 0);
});

test('aggressive mode strips tools only when explicitly enabled', () => {
  const body = {
    model: 'gpt-test',
    messages: [{ role: 'user', content: 'hello' }],
    tools: [sampleTool()]
  };

  const disabled = processChatBody(body, modeConfigFromEnv({ MODE: 'aggressive' }), createState());
  assert.ok(disabled.body.tools);

  const state = createState();
  const config = modeConfigFromEnv({ MODE: 'aggressive', STRIP_TOOLS: '1', HEARTBEAT_INTERVAL: '2' });
  const first = processChatBody(body, config, state);
  const second = processChatBody(body, config, state);

  assert.ok(first.body.tools);
  assert.equal(second.body.tools, undefined);
  assert.equal(second.report.toolsStripped, true);
  assert.ok(second.report.breakdown.toolsStripping > 0);
});

test('safe mode may minify JSON tool output but does not truncate plain output', () => {
  const longText = `${'important '.repeat(500)}final line`;
  const result = processChatBody({
    model: 'gpt-test',
    messages: [{ role: 'tool', content: longText }]
  }, modeConfigFromEnv({ MODE: 'safe' }), createState());

  assert.equal(result.body.messages[0].content, longText);
});

test('xray breakdown counts tools schema and message roles', () => {
  const body = {
    tools: [sampleTool()],
    messages: [
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
      { role: 'assistant', content: 'assistant history' },
      { role: 'tool', content: 'tool output' },
      { role: 'function', content: 'function output' },
      { role: 'developer', content: 'other prompt' }
    ]
  };
  const breakdown = tokenBreakdown(body);

  assert.ok(breakdown.toolsSchema > 0);
  assert.ok(breakdown.systemMessages > 0);
  assert.ok(breakdown.userMessages > 0);
  assert.ok(breakdown.assistantMessages > 0);
  assert.ok(breakdown.toolMessages > 0);
  assert.ok(breakdown.functionMessages > 0);
  assert.ok(breakdown.otherMessages > 0);
});

test('xray breakdown counts captured-style OpenAI request roles without fallback', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'captured-style-request.json');
  const captured = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const breakdown = tokenBreakdown(captured.body);
  const xray = buildXRay(captured.body, captured.body);

  assert.ok(breakdown.toolsSchema > 0);
  assert.ok(breakdown.systemMessages > 0);
  assert.ok(breakdown.userMessages > 0);
  assert.ok(breakdown.assistantMessages > 0);
  assert.ok(breakdown.toolMessages > 0);
  assert.ok(breakdown.functionMessages > 0);
  assert.equal(breakdown.otherMessages, 0);
  assert.deepEqual(xray.tokenBreakdownBefore, breakdown);
});

test('xray top token wasters detect large tool outputs', () => {
  const body = {
    messages: [
      { role: 'user', content: 'short' },
      { role: 'tool', tool_call_id: 'call_big', content: 'large output '.repeat(500) }
    ]
  };
  const xray = buildXRay(body, body);
  const largest = xray.topTokenWasters[0];

  assert.equal(largest.category, 'toolMessages');
  assert.match(largest.label, /largest tool output/);
  assert.ok(largest.estimatedTokens > 100);
});

test('xray does not mutate request body', () => {
  const body = {
    messages: [{ role: 'user', content: 'hello' }],
    tools: [sampleTool()]
  };
  const before = JSON.stringify(body);
  buildXRay(body, body);
  assert.equal(JSON.stringify(body), before);
});

test('cache-aware mode does not strip tools', () => {
  const body = {
    messages: [{ role: 'user', content: 'hello' }],
    tools: [sampleTool()]
  };
  const config = modeConfigFromEnv({ MODE: 'aggressive', STRIP_TOOLS: '1', CACHE_AWARE: '1' });
  const first = processChatBody(body, config, createState());
  const second = processChatBody(body, config, createState());

  assert.equal(config.cacheAware, true);
  assert.equal(config.stripTools, false);
  assert.ok(first.body.tools);
  assert.ok(second.body.tools);
});

test('xray previews are redacted and truncated', () => {
  const preview = safePreview(`Bearer secret-token sk-abcdefghijklmnopqrstuvwxyz password=abc ${'x'.repeat(300)}`, 80);
  assert.match(preview, /Bearer \[REDACTED\]/);
  assert.match(preview, /sk-\[REDACTED\]/);
  assert.match(preview, /password=\[REDACTED\]/);
  assert.ok(preview.length < 120);
});
