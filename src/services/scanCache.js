// Per-card scan-result cache. Clicking a card you've already scanned (this
// session OR from a prior session, via localStorage) returns instantly
// instead of burning another 60-90 seconds of Anthropic web_search budget.
// Re-scan button on the result page forces a fresh fetch when needed.

import { sanitizeCachedPriceNarrative } from './fetchCardData.js';
import { printingIdentity } from './printing.js';
import { enforceExactCreatorSources } from './sourceRelevance.js';

const CACHE_KEY = 'signal_scan_cache_v1';
// Two clocks, because the two halves of a scan go stale at very different rates.
// Signals (creator buzz, scarcity, ban status, JP release timing) move over
// weeks. Prices move daily. Holding both for 7 days served stale money numbers;
// holding both for 24h burned a fresh Anthropic call for data that hadn't moved.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;       // whole scan — 7 days
const PRICE_TTL_MS = 24 * 60 * 60 * 1000;           // price block — 1 day
const MAX_ENTRIES = 200;

export function attachScanPin(data, pin) {
  return data && pin ? { ...data, _pin: pin } : data;
}

// `pin` is a specific printing chosen from the search suggestions. Two
// printings of the same card share a name but not a price, so they must not
// share a cache entry — scanning the $1,495 Prismatic Umbreon must not serve
// the $35 Obsidian Flames one from cache.
function keyFor(name, game, pin) {
  const base = `${(game || 'auto').toLowerCase()}::${String(name || '').trim().toLowerCase()}`;
  const identity = printingIdentity(pin);
  return identity ? `${base}::${identity}` : base;
}

function cleanData(data) {
  return enforceExactCreatorSources(sanitizeCachedPriceNarrative(data), {
    cardName: data?.card_name,
    pin: data?._pin || data?.printing || null,
  });
}

function entryPin(entry) {
  const data = entry?.data;
  return data?._pin || (data?.printing && typeof data.printing === 'object' ? data.printing : null);
}

function findEntry(cache, name, game, pin) {
  const directKey = keyFor(name, game, pin);
  if (cache[directKey]?.data) return { key: directKey, entry: cache[directKey] };
  const wanted = printingIdentity(pin);
  if (!wanted) return null;
  const normalizedGame = String(game || '').toLowerCase();
  const match = Object.entries(cache)
    .sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0))
    .find(([, candidate]) => {
      const candidateGame = String(candidate?.data?.game || '').toLowerCase();
      return candidate?.data
        && (!normalizedGame || !candidateGame || candidateGame === normalizedGame)
        && entryPin(candidate)?.pinned !== false
        && printingIdentity(entryPin(candidate)) === wanted;
    });
  if (!match) return null;
  // Migrate the old broad-name key in place. The next read is direct.
  cache[directKey] = match[1];
  saveCache(cache);
  return { key: directKey, entry: match[1] };
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
  const entry = findEntry(cache, name, game, pin)?.entry;
  if (!entry || !entry.data) return null;
  const age = Date.now() - (entry.ts || 0);
  if (age < 0 || age > CACHE_TTL_MS) return null;
  return cleanData(entry.data);
}

// Same lookup, but also reports whether the PRICE half has aged out. The caller
// renders the cached scan instantly (no loading theater, no Anthropic call) and
// then tops up just the prices from the free TCG APIs when this is true.
export function getCachedScanEntry(name, game, pin) {
  if (!name) return null;
  const cache = loadCache();
  const entry = findEntry(cache, name, game, pin)?.entry;
  if (!entry || !entry.data) return null;
  const age = Date.now() - (entry.ts || 0);
  if (age < 0 || age > CACHE_TTL_MS) return null;
  // priceTs tracks the last price top-up independently of the scan timestamp.
  const priceAge = Date.now() - (entry.priceTs || entry.ts || 0);
  return { data: cleanData(entry.data), pricesStale: priceAge > PRICE_TTL_MS };
}

export function setCachedScan(name, game, data, pin) {
  if (!name || !data || data._truncated) return;
  const cache = loadCache();
  const now = Date.now();
  const cleaned = cleanData(data);
  const entry = { ts: now, priceTs: now, data: cleaned };
  cache[keyFor(name, game, pin)] = entry;
  const resultPin = cleaned?._pin
    || (cleaned?.printing && typeof cleaned.printing === 'object' ? cleaned.printing : null)
    || pin;
  const canonicalName = cleaned?.card_name || name;
  const canonicalGame = cleaned?.game || game;
  if (resultPin?.pinned !== false && printingIdentity(resultPin)) {
    cache[keyFor(canonicalName, canonicalGame, resultPin)] = entry;
  }
  saveCache(cache);
}

// Overwrite only the price block on an existing entry and restart the price
// clock. Leaves the scan's own 7-day clock alone — the signals are unchanged.
export function refreshCachedPrices(name, game, prices, pin) {
  if (!name || !prices) return;
  const cache = loadCache();
  const found = findEntry(cache, name, game, pin);
  const k = found?.key || keyFor(name, game, pin);
  const entry = found?.entry;
  if (!entry || !entry.data) return;
  entry.data = cleanData({
    ...entry.data,
    prices: { ...entry.data.prices, ...prices },
    grading_roi: null,
    _relatedPriceDataStale: true,
  });
  entry.priceTs = Date.now();
  cache[k] = entry;
  saveCache(cache);
}

// Writes the printing onto an existing entry without touching either clock —
// this is a fact about the card, not fresh data about the market.
export function patchCachedPrinting(name, game, printing, pin) {
  if (!name || !printing) return;
  const cache = loadCache();
  const found = findEntry(cache, name, game, pin);
  const k = found?.key || keyFor(name, game, pin);
  const entry = found?.entry;
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
