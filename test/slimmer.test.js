const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  buildXRay,
  compressToolContent,
  createState,
  minifyJsonText,
  modeConfigFromEnv,
  processChatBody,
  safePreview,
  tokenBreakdown,
  slimTools
} = require('../lib/slimmer');

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
  assert.ok(result.body.tools);
  assert.equal(result.report.toolsStripped, false);
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
