// ─── Price history ────────────────────────────────────────────────────────────
// The app knew what a card costs now and nothing about yesterday. TCGplayer's
// article widgets read a per-product history endpoint that answers without a
// key: one row per SKU (variant × condition × language), each with 30 buckets
// of market price and quantity sold. `quarter` is 90 days in three-day steps.
//
// Only the SKU that is this exact card counts: English, Near Mint, and the
// finish the owner chose. A card without a TCGplayer product id has no
// history, and the app says so instead of borrowing a neighbour's line.

import { fetchWithTimeout } from './http.js';
import { fetchCatalogueJSON } from './signalGateway.js';
import { fetchTcgplayerPrice } from './fetchTcgplayerPrice.js';

const CACHE_KEY = 'signal_price_history_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

const VARIANT_BY_FORM = {
  pokemon: {
    normal: ['Normal'],
    holo: ['Holofoil'],
    reverse: ['Reverse Holofoil'],
    first_edition_normal: ['1st Edition', '1st Edition Normal'],
    first_edition_holo: ['1st Edition Holofoil'],
    unlimited_normal: ['Unlimited', 'Unlimited Normal'],
    unlimited_holo: ['Unlimited Holofoil'],
  },
  mtg: {
    normal: ['Normal'],
    foil: ['Foil'],
    etched: ['Etched Foil', 'Etched'],
  },
  yugioh: {},
};

export function historyUrl(productId, range = 'quarter') {
  return `https://infinite-api.tcgplayer.com/price/history/${encodeURIComponent(productId)}/detailed?range=${encodeURIComponent(range)}`;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function latestMarket(sku) {
  const buckets = Array.isArray(sku?.buckets) ? sku.buckets : [];
  for (const bucket of buckets) {
    const market = number(bucket?.marketPrice);
    if (market > 0) return market;
  }
  return null;
}

// Prefer the exact finish, English, Near Mint. When the finish has no SKU
// (Yu-Gi-Oh has one printing per product) take the single variant offered;
// when several variants remain, take the one priced nearest the card's own
// current price rather than guessing.
export function pickHistorySku(result, pin) {
  const skus = (Array.isArray(result) ? result : []).filter((sku) => Array.isArray(sku?.buckets) && sku.buckets.length);
  if (!skus.length) return null;
  const english = skus.filter((sku) => !sku.language || /english/i.test(sku.language));
  const pool = english.length ? english : skus;
  const nearMint = pool.filter((sku) => /near mint/i.test(sku.condition || ''));
  const conditioned = nearMint.length ? nearMint : pool;
  const wanted = (VARIANT_BY_FORM[pin?.game] || {})[pin?.form] || [];
  const byVariant = wanted.length
    ? conditioned.filter((sku) => wanted.some((name) => String(sku.variant || '').toLowerCase() === name.toLowerCase()))
    : [];
  if (byVariant.length) return byVariant[0];
  const variants = new Set(conditioned.map((sku) => String(sku.variant || '')));
  if (variants.size === 1) return conditioned[0];
  const price = number(pin?.price);
  if (!(price > 0)) return null;
  return conditioned
    .map((sku) => ({ sku, gap: Math.abs((latestMarket(sku) || 0) - price) }))
    .sort((a, b) => a.gap - b.gap)[0]?.sku || null;
}

// Buckets are three days apart on the quarter feed and the feed spans 87
// days, so "90 days ago" is the point nearest that age within a fifth of the
// window, never an invented one.
function changeSince(points, days, now) {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const minAge = days * (1 - 0.2) * DAY_MS;
  let then = null;
  for (const point of points) {
    if (point === latest) break;
    const age = now - point.time;
    if (age < minAge) break;
    if (!then || Math.abs(age - days * DAY_MS) < Math.abs((now - then.time) - days * DAY_MS)) then = point;
  }
  if (!then || !(then.market > 0)) return null;
  return Math.round(((latest.market - then.market) / then.market) * 1000) / 10;
}

export function shapeHistory(sku, { now = Date.now() } = {}) {
  if (!sku) return null;
  const points = (Array.isArray(sku.buckets) ? sku.buckets : [])
    .map((bucket) => ({
      date: String(bucket?.bucketStartDate || '').slice(0, 10),
      time: new Date(`${String(bucket?.bucketStartDate || '').slice(0, 10)}T00:00:00Z`).getTime(),
      market: number(bucket?.marketPrice),
      sold: Math.max(0, Math.floor(number(bucket?.quantitySold) || 0)),
    }))
    .filter((point) => point.date && Number.isFinite(point.time) && point.market > 0)
    .sort((a, b) => a.time - b.time);
  if (!points.length) return null;
  const latest = points[points.length - 1];
  const recent = points.filter((point) => point.time >= now - 30 * DAY_MS);
  return {
    skuId: sku.skuId ?? null,
    variant: sku.variant || null,
    condition: sku.condition || null,
    latest: latest.market,
    latestDate: latest.date,
    change7: changeSince(points, 7, now),
    change30: changeSince(points, 30, now),
    change90: changeSince(points, 90, now),
    sold30: recent.reduce((sum, point) => sum + point.sold, 0),
    points: points.map((point) => [point.date, point.market]),
    checkedAt: new Date(now).toISOString(),
  };
}

const signed = (value) => (value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value}%`);

export function historyBlock(history) {
  if (!history || !history.points?.length) return null;
  const first = history.points[0];
  return [
    '=== PRICE HISTORY (pre-fetched — TCGplayer market price for this exact product; use it for prices.signal_vs_market and the summary; do NOT re-search prices) ===',
    `SKU: ${[history.variant, history.condition].filter(Boolean).join(' · ')} | latest $${history.latest} on ${history.latestDate}`,
    `7-day: ${signed(history.change7)} | 30-day: ${signed(history.change30)} | 90-day: ${signed(history.change90)} (first point $${first[1]} on ${first[0]})`,
    `Copies sold on TCGplayer in the last 30 days: ${history.sold30}`,
  ].join('\n');
}

// Score direction against the real 30-day move. Replaces the model's guess.
export function alignmentFromHistory(score, change30) {
  if (!Number.isFinite(Number(score)) || change30 === null || change30 === undefined) return null;
  const up = score >= 56;
  const down = score < 45;
  const rose = change30 >= 3;
  const fell = change30 <= -3;
  if ((up && rose) || (down && fell)) return 'agree';
  if ((up && fell) || (down && rose)) return 'disagree';
  return 'mixed';
}

function readCache(key, now) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = cache[key];
    if (!entry || now - (entry.ts || 0) > CACHE_TTL_MS || now - (entry.ts || 0) < 0) return null;
    return entry.history;
  } catch {
    return null;
  }
}

function writeCache(key, history, now) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[key] = { ts: now, history };
    const entries = Object.entries(cache).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, MAX_CACHE);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

async function loadHistory(productId, range, signal) {
  const url = historyUrl(productId, range);
  try {
    const relayed = await fetchCatalogueJSON(url, signal);
    if (relayed) return relayed;
  } catch {}
  const res = await fetchWithTimeout(url, { signal, headers: { Accept: 'application/json' } }, 8000);
  if (!res.ok) return null;
  return res.json();
}

export async function resolveProductId(pin, signal) {
  const own = Number(pin?.tcgplayerProductId);
  if (Number.isInteger(own) && own > 0) return own;
  const found = await fetchTcgplayerPrice(pin, signal).catch(() => null);
  const id = Number(found?.productId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function fetchPriceHistory(pin, { signal, range = 'quarter', now = Date.now() } = {}) {
  if (!pin?.game) return null;
  const productId = await resolveProductId(pin, signal);
  if (!productId) return null;
  const key = `${productId}:${pin.form || ''}:${range}`;
  const cached = readCache(key, now);
  if (cached) return { productId, ...cached };
  let payload;
  try {
    payload = await loadHistory(productId, range, signal);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return null;
  }
  const history = shapeHistory(pickHistorySku(payload?.result, pin), { now });
  if (!history) return null;
  writeCache(key, history, now);
  return { productId, ...history };
}

export { CACHE_KEY as PRICE_HISTORY_CACHE_KEY };
