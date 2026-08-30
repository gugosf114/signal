const CACHE_KEY = 'signal_usd_exchange_rates_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const STALE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_URL = 'https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,JPY&providers=ECB';

function targetStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage || null; } catch { return null; }
}

function normalizeRateData(value, fetchedAt = Date.now()) {
  if (!value || typeof value !== 'object') return null;
  const eur = Number(value?.rates?.EUR);
  const jpy = Number(value?.rates?.JPY);
  if (!Number.isFinite(eur) || eur <= 0 || !Number.isFinite(jpy) || jpy <= 0) return null;
  return {
    base: 'USD',
    date: String(value.date || ''),
    rates: { EUR: eur, JPY: jpy },
    fetchedAt: Number(value.fetchedAt) || fetchedAt,
  };
}

export function parseUsdRateRows(rows, fetchedAt = Date.now()) {
  const rates = {};
  let date = '';
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.base !== 'USD' || !['EUR', 'JPY'].includes(row?.quote)) continue;
    const rate = Number(row.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    rates[row.quote] = rate;
    if (!date && row.date) date = String(row.date);
  }
  return normalizeRateData({ date, rates, fetchedAt }, fetchedAt);
}

export function readCachedUsdRates(storage, now = Date.now()) {
  try {
    const raw = targetStorage(storage)?.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = normalizeRateData(JSON.parse(raw));
    if (!data) return null;
    const age = now - data.fetchedAt;
    if (age < 0 || age > STALE_MAX_AGE_MS) return null;
    return { ...data, stale: age > CACHE_TTL_MS };
  } catch {
    return null;
  }
}

function writeRates(data, storage) {
  try { targetStorage(storage)?.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

export async function fetchUsdRates({ fetchImpl = globalThis.fetch, storage, now = Date.now() } = {}) {
  const cached = readCachedUsdRates(storage, now);
  if (cached && !cached.stale) return cached;
  if (typeof fetchImpl !== 'function') return cached;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 6000) : null;
  try {
    const response = await fetchImpl(RATE_URL, controller ? { signal: controller.signal } : undefined);
    if (!response?.ok) throw new Error(`Exchange rates ${response?.status || 'failed'}`);
    const data = parseUsdRateRows(await response.json(), now);
    if (!data) throw new Error('Exchange rate response incomplete');
    writeRates(data, storage);
    return { ...data, stale: false };
  } catch {
    return cached;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function convertUsd(usd, rate) {
  const amount = Number(usd);
  const multiplier = Number(rate);
  return Number.isFinite(amount) && amount >= 0 && Number.isFinite(multiplier) && multiplier > 0
    ? amount * multiplier
    : null;
}

export { CACHE_KEY, CACHE_TTL_MS, RATE_URL, STALE_MAX_AGE_MS };
