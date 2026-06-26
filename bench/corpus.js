const fs = require('fs');
const path = require('path');
const {
  createState,
  buildXRay,
  emptyTokenBreakdown,
  estimatePromptTokens,
  modeConfigFromEnv,
  processChatBody
} = require('../lib/slimmer');

const RUNS = [
  { label: 'safe', env: { MODE: 'safe' } },
  { label: 'balanced', env: { MODE: 'balanced' } },
  { label: 'aggressive', env: { MODE: 'aggressive' } },
  { label: 'aggressive+STRIP_TOOLS', env: { MODE: 'aggressive', STRIP_TOOLS: '1' } }
];

function escapeRegExp(text) {
  return text.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern) {
  const normalized = path.resolve(pattern).replace(/\\/g, '/');
  let source = '';
  for (const ch of normalized) {
    if (ch === '*') source += '[^/]*';
    else source += escapeRegExp(ch);
  }
  return new RegExp(`^${source}$`);
}

function walkJsonFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function globBase(pattern) {
  const resolved = path.resolve(pattern);
  const firstMagic = resolved.search(/[*?]/);
  if (firstMagic === -1) return resolved;
  const prefix = resolved.slice(0, firstMagic);
  const slash = Math.max(prefix.lastIndexOf('\\'), prefix.lastIndexOf('/'));
  return slash <= 0 ? process.cwd() : prefix.slice(0, slash);
}

function resolveInputs(args) {
  const files = new Set();
  for (const arg of args) {
    const hasGlob = /[*?]/.test(arg);
    if (hasGlob) {
      const base = globBase(arg);
      const matcher = globToRegExp(arg);
      if (!fs.existsSync(base)) continue;
      for (const file of walkJsonFiles(base)) {
        if (matcher.test(path.resolve(file).replace(/\\/g, '/'))) files.add(file);
      }
      continue;
    }

    const resolved = path.resolve(arg);
    if (!fs.existsSync(resolved)) continue;
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      walkJsonFiles(resolved).forEach(file => files.add(file));
    } else if (stat.isFile() && resolved.endsWith('.json')) {
      files.add(resolved);
    }
  }
  return Array.from(files).sort();
}

function unwrapRequest(parsed) {
  if (parsed && typeof parsed === 'object' && parsed.body && (parsed.headers || parsed.captured_at || parsed.method)) {
    return parsed.body;
  }
  return parsed;
}

function loadRequest(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return unwrapRequest(parsed);
}

function runMode(body, run) {
  const config = modeConfigFromEnv({ ...process.env, ...run.env });
  const state = createState();
  if (config.mode === 'aggressive' && config.stripTools) {
    processChatBody(body, config, state);
  }
  const processed = processChatBody(body, config, state);
  const { report } = processed;
  report.xray = buildXRay(body, processed.body, report.providerProfile);
  return report;
}

function percent(saved, original) {
  return original > 0 ? `${((saved / original) * 100).toFixed(1)}%` : '0.0%';
}

function number(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function recommendedUse(mode) {
  switch (mode) {
    case 'safe':
      return 'Low-risk baseline; smallest savings';
    case 'balanced':
      return 'Recommended normal agent mode; no tools stripping';
    case 'aggressive':
      return 'Higher savings, lossy; test agent behavior';
    case 'aggressive+STRIP_TOOLS':
      return 'Experimental; may affect tool calling';
    default:
      return '';
  }
}

function reportForFile(file, body) {
  const original = estimatePromptTokens(body, modeConfigFromEnv(process.env).providerProfile);
  const modes = [];
  for (const run of RUNS) {
    const report = runMode(body, run);
    modes.push({
      mode: run.label,
      originalTokens: report.beforeTokens,
      compressedTokens: report.afterTokens,
      savedTokens: report.savedTokens,
      savedPercent: report.beforeTokens > 0 ? Number(((report.savedTokens / report.beforeTokens) * 100).toFixed(1)) : 0,
      schemaSlimmingSaved: report.breakdown.toolSchemaSlimming,
      contentCompressionSaved: report.breakdown.toolOutputCompression,
      summaryCacheSaved: report.breakdown.summaryCache || 0,
      toolsStrippingSaved: report.breakdown.toolsStripping,
      xrayBefore: report.xray.tokenBreakdownBefore,
      xrayAfter: report.xray.tokenBreakdownAfter,
      xraySaved: report.xray.tokenBreakdownSaved
    });
  }
  return {
    file,
    originalTokens: original,
    modes
  };
}

function printFileReport(fileReport) {
  const original = fileReport.originalTokens;
  const xrayBefore = fileReport.modes[0]?.xrayBefore || emptyTokenBreakdown();
  console.log(`File: ${path.relative(process.cwd(), fileReport.file)}`);
  console.log(`Original estimated tokens: ${original}`);
  console.log(`X-Ray before: tools=${xrayBefore.toolsSchema || 0} system=${xrayBefore.systemMessages || 0} user=${xrayBefore.userMessages || 0} assistant=${xrayBefore.assistantMessages || 0} tool=${xrayBefore.toolMessages || 0} function=${xrayBefore.functionMessages || 0} other=${xrayBefore.otherMessages || 0}`);
  console.log('mode                       original  compressed  saved  saved%  schema  output  summary  strip  xraySaved.tools  xraySaved.system  xraySaved.user  xraySaved.assistant  xraySaved.tool/function  xraySaved.other');

  for (const report of fileReport.modes) {
    const xraySaved = report.xraySaved;
    const cols = [
      report.mode.padEnd(26),
      String(original).padStart(8),
      String(report.compressedTokens).padStart(10),
      String(report.savedTokens).padStart(6),
      `${report.savedPercent.toFixed(1)}%`.padStart(7),
      String(report.schemaSlimmingSaved).padStart(7),
      String(report.contentCompressionSaved).padStart(7),
      String(report.summaryCacheSaved || 0).padStart(7),
      String(report.toolsStrippingSaved).padStart(6),
      String(xraySaved.toolsSchema || 0).padStart(6),
      String(xraySaved.systemMessages || 0).padStart(7),
      String(xraySaved.userMessages || 0).padStart(4),
      String(xraySaved.assistantMessages || 0).padStart(9),
      String((xraySaved.toolMessages || 0) + (xraySaved.functionMessages || 0)).padStart(13),
      String(xraySaved.otherMessages || 0).padStart(5)
    ];
    console.log(cols.join('  '));
  }
  console.log('');
}

function addBreakdown(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    target[key] = (target[key] || 0) + (value || 0);
  }
}

function printAggregate(aggregate) {
  console.log('Corpus aggregate:');
  console.log('mode                       original  compressed  saved  saved%  schema  output  summary  strip');
  for (const run of RUNS) {
    const data = aggregate[run.label];
    const saved = data.before - data.after;
    console.log([
      run.label.padEnd(26),
      String(data.before).padStart(8),
      String(data.after).padStart(10),
      String(saved).padStart(6),
      percent(saved, data.before).padStart(7),
      String(data.schemaSaved || 0).padStart(7),
      String(data.contentSaved || 0).padStart(7),
      String(data.summaryCacheSaved || 0).padStart(7),
      String(data.stripSaved || 0).padStart(6)
    ].join('  '));
  }
  printXRayAggregate('X-Ray before by category:', aggregate, 'xrayBefore');
  printXRayAggregate('X-Ray saved by category:', aggregate, 'xraySaved');
}

function printXRayAggregate(title, aggregate, key) {
  console.log('');
  console.log(title);
  console.log('mode                       tools  system    user  assistant    tool  function  other');
  for (const run of RUNS) {
    const b = aggregate[run.label][key];
    console.log([
      run.label.padEnd(26),
      String(b.toolsSchema || 0).padStart(6),
      String(b.systemMessages || 0).padStart(7),
      String(b.userMessages || 0).padStart(7),
      String(b.assistantMessages || 0).padStart(9),
      String(b.toolMessages || 0).padStart(7),
      String(b.functionMessages || 0).padStart(8),
      String(b.otherMessages || 0).padStart(5)
    ].join('  '));
  }
}

function writeReports(fileReports, aggregate, sourceArgs) {
  const reportsDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const json = {
    generatedAt,
    sourceArgs,
    fileCount: fileReports.length,
    files: fileReports.map(fileReport => ({
      file: path.relative(process.cwd(), fileReport.file),
      originalTokens: fileReport.originalTokens,
      modes: fileReport.modes
    })),
    aggregate
  };
  fs.writeFileSync(path.join(reportsDir, 'eval-modes.json'), `${JSON.stringify(json, null, 2)}\n`);

  const isRealCapture = fileReports.some(fileReport =>
    path.relative(process.cwd(), fileReport.file).replace(/\\/g, '/').startsWith('captures/')
  );
  const lines = [
    '# Token Slimmer Mode Evaluation',
    '',
    `Generated: ${generatedAt}`,
    `Files: ${fileReports.length}`,
    `Sources: ${sourceArgs.join(', ')}`,
    '',
    isRealCapture ? '## Real Hermes Capture Summary' : '## Corpus Summary',
    '',
    isRealCapture
      ? 'This summary is generated from local captured Hermes/OpenAI-compatible request JSON files. Synthetic samples are not used as real-world results in this section.'
      : 'This summary is generated from the provided benchmark corpus. Treat synthetic samples as shape coverage, not real-world savings.',
    '',
    '| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools | Recommended use |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ];
  for (const run of RUNS) {
    const data = aggregate[run.label];
    const saved = data.before - data.after;
    lines.push(`| ${run.label} | ${number(data.before)} | ${number(data.after)} | ${number(saved)} | ${percent(saved, data.before)} | ${number(data.schemaSaved)} | ${number(data.contentSaved)} | ${number(data.summaryCacheSaved)} | ${number(data.stripSaved)} | ${recommendedUse(run.label)} |`);
  }
  lines.push('');
  appendXRaySection(lines, aggregate);

  lines.push('', '## File Details', '');
  for (const fileReport of fileReports) {
    lines.push(`### ${path.relative(process.cwd(), fileReport.file)}`, '');
    lines.push('| Mode | Original | Compressed | Saved | Saved % | Schema | Content/Output | Summary Cache | Strip Tools |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (const mode of fileReport.modes) {
      lines.push(`| ${mode.mode} | ${number(mode.originalTokens)} | ${number(mode.compressedTokens)} | ${number(mode.savedTokens)} | ${mode.savedPercent.toFixed(1)}% | ${number(mode.schemaSlimmingSaved)} | ${number(mode.contentCompressionSaved)} | ${number(mode.summaryCacheSaved)} | ${number(mode.toolsStrippingSaved)} |`);
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(reportsDir, 'eval-modes.md'), `${lines.join('\n')}\n`);
}

function appendXRaySection(lines, aggregate) {
  lines.push('## Aggregate Token X-Ray', '');
  appendXRayTable(lines, 'Before Compression', aggregate, 'xrayBefore');
  appendXRayTable(lines, 'After Compression', aggregate, 'xrayAfter');
  appendXRayTable(lines, 'Saved By Category', aggregate, 'xraySaved');
}

function appendXRayTable(lines, title, aggregate, key) {
  lines.push(`### ${title}`, '');
  lines.push('| Mode | Tools Schema | System | User | Assistant | Tool | Function | Other |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const run of RUNS) {
    const b = aggregate[run.label][key];
    lines.push(`| ${run.label} | ${number(b.toolsSchema)} | ${number(b.systemMessages)} | ${number(b.userMessages)} | ${number(b.assistantMessages)} | ${number(b.toolMessages)} | ${number(b.functionMessages)} | ${number(b.otherMessages)} |`);
  }
  lines.push('');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run bench:corpus <file-or-dir-or-glob> [...]');
    console.error('Examples: npm run bench:corpus captures/');
    console.error('          npm run bench:corpus bench/samples/*.json');
    process.exitCode = 1;
    return;
  }

  const files = resolveInputs(args);
  if (files.length === 0) {
    console.error('No JSON files matched.');
    process.exitCode = 1;
    return;
  }

  const aggregate = Object.fromEntries(RUNS.map(run => [run.label, {
    before: 0,
    after: 0,
    schemaSaved: 0,
    contentSaved: 0,
    summaryCacheSaved: 0,
    stripSaved: 0,
    xrayBefore: emptyTokenBreakdown(),
    xrayAfter: emptyTokenBreakdown(),
    xraySaved: emptyTokenBreakdown()
  }]));
  const fileReports = [];

  for (const file of files) {
    try {
      const body = loadRequest(file);
      const fileReport = reportForFile(file, body);
      fileReports.push(fileReport);
      printFileReport(fileReport);
      for (const modeReport of fileReport.modes) {
        const original = modeReport.originalTokens;
        const modeAggregate = aggregate[modeReport.mode];
        modeAggregate.before += original;
        modeAggregate.after += modeReport.compressedTokens;
        modeAggregate.schemaSaved += modeReport.schemaSlimmingSaved;
        modeAggregate.contentSaved += modeReport.contentCompressionSaved;
        modeAggregate.summaryCacheSaved += modeReport.summaryCacheSaved;
        modeAggregate.stripSaved += modeReport.toolsStrippingSaved;
        addBreakdown(modeAggregate.xrayBefore, modeReport.xrayBefore);
        addBreakdown(modeAggregate.xrayAfter, modeReport.xrayAfter);
        addBreakdown(modeAggregate.xraySaved, modeReport.xraySaved);
      }
    } catch (err) {
      console.error(`Failed to benchmark ${file}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  printAggregate(aggregate);
  writeReports(fileReports, aggregate, args);
  console.log('');
  console.log('Reports written:');
  console.log('  reports/eval-modes.md');
  console.log('  reports/eval-modes.json');
}

main();
