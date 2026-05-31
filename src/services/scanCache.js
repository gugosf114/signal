// Per-card scan-result cache. Clicking a card you've already scanned (this
// session OR from a prior session, via localStorage) returns instantly
// instead of burning another 60-90 seconds of Anthropic web_search budget.
// Re-scan button on the result page forces a fresh fetch when needed.

const CACHE_KEY = 'signal_scan_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ENTRIES = 200;

function keyFor(name, game) {
  return `${(game || 'auto').toLowerCase()}::${String(name || '').trim().toLowerCase()}`;
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    // Prune to MAX_ENTRIES newest if we've grown too big.
    const entries = Object.entries(cache);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0));
      const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
      return;
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full / disabled — silently skip
  }
}

export function getCachedScan(name, game) {
  if (!name) return null;
  const cache = loadCache();
  const entry = cache[keyFor(name, game)];
  if (!entry || !entry.data) return null;
  if (Date.now() - (entry.ts || 0) > CACHE_TTL_MS) return null;
  return entry.data;
}

export function setCachedScan(name, game, data) {
  if (!name || !data) return;
  const cache = loadCache();
  cache[keyFor(name, game)] = { ts: Date.now(), data };
  saveCache(cache);
}

export function clearCachedScan(name, game) {
  if (!name) return;
  const cache = loadCache();
  delete cache[keyFor(name, game)];
  saveCache(cache);
}
