import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_KEY,
  CACHE_TTL_MS,
  convertUsd,
  fetchUsdRates,
  parseUsdRateRows,
  readCachedUsdRates,
} from './exchangeRates.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

const ROWS = [
  { date: '2026-08-28', base: 'USD', quote: 'EUR', rate: 0.85889 },
  { date: '2026-08-28', base: 'USD', quote: 'JPY', rate: 159.68 },
];

test('parses the two required USD exchange rates', () => {
  assert.deepEqual(parseUsdRateRows(ROWS, 1000), {
    base: 'USD', date: '2026-08-28', rates: { EUR: 0.85889, JPY: 159.68 }, fetchedAt: 1000,
  });
});

test('fetches and caches ECB rates', async () => {
  const storage = memoryStorage();
  const result = await fetchUsdRates({ storage, now: 2000, fetchImpl: async () => ({ ok: true, json: async () => ROWS }) });
  assert.equal(result.rates.JPY, 159.68);
  assert.equal(JSON.parse(storage.getItem(CACHE_KEY)).date, '2026-08-28');
});

test('uses a fresh cache without making another request', async () => {
  const storage = memoryStorage();
  storage.setItem(CACHE_KEY, JSON.stringify({ base: 'USD', date: '2026-08-28', rates: { EUR: 0.85, JPY: 159 }, fetchedAt: 1000 }));
  let calls = 0;
  const result = await fetchUsdRates({ storage, now: 1000 + CACHE_TTL_MS - 1, fetchImpl: async () => { calls += 1; } });
  assert.equal(calls, 0);
  assert.equal(result.stale, false);
});

test('keeps a stale cached rate when the network fails', async () => {
  const storage = memoryStorage();
  storage.setItem(CACHE_KEY, JSON.stringify({ base: 'USD', date: '2026-08-27', rates: { EUR: 0.84, JPY: 158 }, fetchedAt: 1000 }));
  const result = await fetchUsdRates({ storage, now: 1000 + CACHE_TTL_MS + 1, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(result.stale, true);
  assert.equal(readCachedUsdRates(storage, 1000 + CACHE_TTL_MS + 1).rates.EUR, 0.84);
});

test('converts the collection subtotal without rounding it early', () => {
  assert.ok(Math.abs(convertUsd(504.98, 0.85889) - 433.7222722) < 1e-8);
  assert.ok(Math.abs(convertUsd(504.98, 159.68) - 80635.2064) < 1e-8);
});
