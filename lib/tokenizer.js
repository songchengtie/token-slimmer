const PROVIDER_PROFILES = {
  generic: { multiplier: 1 },
  openai: { multiplier: 1 },
  anthropic: { multiplier: 1.06 },
  gemini: { multiplier: 0.96 },
  deepseek: { multiplier: 1.03 },
  qwen: { multiplier: 1.08 }
};

function normalizeProviderProfile(value) {
  const profile = String(value || 'generic').toLowerCase();
  return Object.prototype.hasOwnProperty.call(PROVIDER_PROFILES, profile)
    ? profile
    : 'generic';
}

function fallbackEstimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  return Math.ceil(cjk + (s.length - cjk) / 4);
}

function estimateTokens(text, profile = 'generic') {
  const base = fallbackEstimateTokens(text);
  if (base === 0) return 0;
  const normalized = normalizeProviderProfile(profile);
  const multiplier = PROVIDER_PROFILES[normalized].multiplier;
  return Math.max(1, Math.ceil(base * multiplier));
}

function estimatePromptTokens(body, profile = 'generic') {
  return estimateTokens(JSON.stringify(body || {}), profile);
}

module.exports = {
  PROVIDER_PROFILES,
  estimatePromptTokens,
  estimateTokens,
  fallbackEstimateTokens,
  normalizeProviderProfile
};
