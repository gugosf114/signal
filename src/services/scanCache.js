// Per-card scan-result cache. Clicking a card you've already scanned (this
// session OR from a prior session, via localStorage) returns instantly
// instead of burning another 60-90 seconds of Anthropic web_search budget.
// Re-scan button on the result page forces a fresh fetch when needed.

const CACHE_KEY = 'signal_scan_cache_v1';
// Two clocks, because the two halves of a scan go stale at very different rates.
// Signals (creator buzz, scarcity, ban status, JP release timing) move over
// weeks. Prices move daily. Holding both for 7 days served stale money numbers;
// holding both for 24h burned a fresh Anthropic call for data that hadn't moved.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;       // whole scan — 7 days
const PRICE_TTL_MS = 24 * 60 * 60 * 1000;           // price block — 1 day
const MAX_ENTRIES = 200;

// `pin` is a specific printing chosen from the search suggestions. Two
// printings of the same card share a name but not a price, so they must not
// share a cache entry — scanning the $1,495 Prismatic Umbreon must not serve
// the $35 Obsidian Flames one from cache.
function keyFor(name, game, pin) {
  const base = `${(game || 'auto').toLowerCase()}::${String(name || '').trim().toLowerCase()}`;
  const printingId = pin?.printingId || pin?.id;
  return printingId ? `${base}::${String(printingId).toLowerCase()}` : base;
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

export function getCachedScan(name, game, pin) {
  if (!name) return null;
  const cache = loadCache();
  const entry = cache[keyFor(name, game, pin)];
  if (!entry || !entry.data) return null;
  const age = Date.now() - (entry.ts || 0);
  if (age < 0 || age > CACHE_TTL_MS) return null;
  return entry.data;
}

// Same lookup, but also reports whether the PRICE half has aged out. The caller
// renders the cached scan instantly (no loading theater, no Anthropic call) and
// then tops up just the prices from the free TCG APIs when this is true.
export function getCachedScanEntry(name, game, pin) {
  if (!name) return null;
  const cache = loadCache();
  const entry = cache[keyFor(name, game, pin)];
  if (!entry || !entry.data) return null;
  const age = Date.now() - (entry.ts || 0);
  if (age < 0 || age > CACHE_TTL_MS) return null;
  // priceTs tracks the last price top-up independently of the scan timestamp.
  const priceAge = Date.now() - (entry.priceTs || entry.ts || 0);
  return { data: entry.data, pricesStale: priceAge > PRICE_TTL_MS };
}

export function setCachedScan(name, game, data, pin) {
  if (!name || !data || data._truncated) return;
  const cache = loadCache();
  const now = Date.now();
  cache[keyFor(name, game, pin)] = { ts: now, priceTs: now, data };
  saveCache(cache);
}

// Overwrite only the price block on an existing entry and restart the price
// clock. Leaves the scan's own 7-day clock alone — the signals are unchanged.
export function refreshCachedPrices(name, game, prices, pin) {
  if (!name || !prices) return;
  const cache = loadCache();
  const k = keyFor(name, game, pin);
  const entry = cache[k];
  if (!entry || !entry.data) return;
  entry.data = {
    ...entry.data,
    prices: { ...entry.data.prices, ...prices },
    grading_roi: null,
    _relatedPriceDataStale: true,
  };
  entry.priceTs = Date.now();
  cache[k] = entry;
  saveCache(cache);
}

// Writes the printing onto an existing entry without touching either clock —
// this is a fact about the card, not fresh data about the market.
export function patchCachedPrinting(name, game, printing, pin) {
  if (!name || !printing) return;
  const cache = loadCache();
  const k = keyFor(name, game, pin);
  const entry = cache[k];
  if (!entry || !entry.data) return;
  entry.data = { ...entry.data, printing };
  cache[k] = entry;
  saveCache(cache);
}

export function clearCachedScan(name, game, pin) {
  if (!name) return;
  const cache = loadCache();
  delete cache[keyFor(name, game, pin)];
  saveCache(cache);
}
