const fs = require('fs');
const path = require('path');
const {
  createState,
  estimatePromptTokens,
  buildXRay,
  modeConfigFromEnv,
  processChatBody
} = require('../lib/slimmer');

function loadSamples(dir) {
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => {
      const fullPath = path.join(dir, file);
      return {
        name: file,
        body: JSON.parse(fs.readFileSync(fullPath, 'utf8'))
      };
    });
}

function printReport(sampleName, report) {
  const pct = report.beforeTokens > 0
    ? ((report.savedTokens / report.beforeTokens) * 100).toFixed(1)
    : '0.0';
  console.log(`Sample: ${sampleName}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Original estimated prompt tokens: ${report.beforeTokens}`);
  console.log(`Compressed estimated prompt tokens: ${report.afterTokens}`);
  console.log(`Estimated savings: ${report.savedTokens} (${pct}%)`);
  console.log('Savings by category:');
  console.log(`  tool schema slimming: ${report.breakdown.toolSchemaSlimming}`);
  console.log(`  tool output compression: ${report.breakdown.toolOutputCompression}`);
  console.log(`  tools stripping: ${report.breakdown.toolsStripping}`);
  console.log('X-Ray breakdown before:');
  printXrayBreakdown(report.xray.tokenBreakdownBefore);
  console.log('X-Ray breakdown after:');
  printXrayBreakdown(report.xray.tokenBreakdownAfter);
  console.log('X-Ray saved by category:');
  printXrayBreakdown(report.xray.tokenBreakdownSaved);
  console.log('');
}

function printXrayBreakdown(breakdown) {
  console.log(`  tools schema: ${breakdown.toolsSchema || 0}`);
  console.log(`  system messages: ${breakdown.systemMessages || 0}`);
  console.log(`  user messages: ${breakdown.userMessages || 0}`);
  console.log(`  assistant messages: ${breakdown.assistantMessages || 0}`);
  console.log(`  tool/function outputs: ${(breakdown.toolMessages || 0) + (breakdown.functionMessages || 0)}`);
  console.log(`  other messages: ${breakdown.otherMessages || 0}`);
}

function main() {
  const config = modeConfigFromEnv(process.env);
  const sampleDir = path.join(__dirname);
  const samples = loadSamples(sampleDir);
  if (samples.length === 0) {
    console.error('No benchmark samples found.');
    process.exitCode = 1;
    return;
  }

  for (const sample of samples) {
    const original = estimatePromptTokens(sample.body);
    const state = createState();
    if (config.mode === 'aggressive' && config.stripTools) {
      processChatBody(sample.body, config, state);
    }
    const { body, report } = processChatBody(sample.body, config, state);
    report.beforeTokens = original;
    report.xray = buildXRay(sample.body, body);
    printReport(sample.name, report);
  }
}

main();
