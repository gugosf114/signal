// Tests for the scan cache's printing awareness.
//
// The bug this pins: the cache was keyed on name + game only. "Umbreon ex" is
// a $1,495 card in Prismatic Evolutions #161 and a $7 card in Prismatic
// Evolutions #60 — same name, same game, same set, 200× the price. Scanning
// one and then the other served the first one's answer out of cache, complete
// with the wrong money number and the wrong verdict.
//
// localStorage is stubbed before the module is imported.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const {
  getCachedScan,
  setCachedScan,
  clearCachedScan,
  refreshCachedPrices,
} = await import('./scanCache.js');

const RICH = { id: 'sv8pt5-161', game: 'pokemon' };
const CHEAP = { id: 'sv8pt5-60', game: 'pokemon' };
const YGO_COMMON = { id: '89631139', printingId: '89631139:LDK2-ENJ01', game: 'yugioh' };
const YGO_ULTRA = { id: '89631139', printingId: '89631139:LOB-EN001', game: 'yugioh' };

describe('scanCache printing keys', () => {
  beforeEach(() => { store = {}; });

  test('two printings of one name do not share an entry', () => {
    setCachedScan('Umbreon ex', 'pokemon', { prices: { en: 1495 } }, RICH);
    setCachedScan('Umbreon ex', 'pokemon', { prices: { en: 7 } }, CHEAP);

    assert.equal(getCachedScan('Umbreon ex', 'pokemon', RICH).prices.en, 1495);
    assert.equal(getCachedScan('Umbreon ex', 'pokemon', CHEAP).prices.en, 7);
  });

  test('a pinned scan is not served to an unpinned search', () => {
    setCachedScan('Umbreon ex', 'pokemon', { prices: { en: 1495 } }, RICH);
    assert.equal(getCachedScan('Umbreon ex', 'pokemon'), null);
  });

  test('Yu-Gi-Oh reprints sharing one card id use different entries', () => {
    setCachedScan('Blue-Eyes White Dragon', 'yugioh', { printing: 'common' }, YGO_COMMON);
    setCachedScan('Blue-Eyes White Dragon', 'yugioh', { printing: 'ultra' }, YGO_ULTRA);
    assert.equal(getCachedScan('Blue-Eyes White Dragon', 'yugioh', YGO_COMMON).printing, 'common');
    assert.equal(getCachedScan('Blue-Eyes White Dragon', 'yugioh', YGO_ULTRA).printing, 'ultra');
  });

  test('unpinned scans still round-trip', () => {
    setCachedScan('Black Lotus', 'mtg', { prices: { en: 7312 } });
    assert.equal(getCachedScan('Black Lotus', 'mtg').prices.en, 7312);
  });

  test('a price top-up lands on the pinned entry only', () => {
    setCachedScan('Umbreon ex', 'pokemon', { prices: { en: 1495 } }, RICH);
    setCachedScan('Umbreon ex', 'pokemon', { prices: { en: 7 } }, CHEAP);

    refreshCachedPrices('Umbreon ex', 'pokemon', { en: 1400 }, RICH);

    assert.equal(getCachedScan('Umbreon ex', 'pokemon', RICH).prices.en, 1400);
    assert.equal(getCachedScan('Umbreon ex', 'pokemon', CHEAP).prices.en, 7);
  });

  test('clearing one printing leaves the other alone', () => {
    setCachedScan('Umbreon ex', 'pokemon', { prices: { en: 1495 } }, RICH);
    setCachedScan('Umbreon ex', 'pokemon', { prices: { en: 7 } }, CHEAP);

    clearCachedScan('Umbreon ex', 'pokemon', RICH);

    assert.equal(getCachedScan('Umbreon ex', 'pokemon', RICH), null);
    assert.equal(getCachedScan('Umbreon ex', 'pokemon', CHEAP).prices.en, 7);
  });

  test('a pin with no id behaves like no pin at all', () => {
    // Browse-grid cards from a catalogue that gives us no stable id must not
    // each get their own cache entry keyed on "undefined".
    setCachedScan('Dark Magician', 'yugioh', { prices: { en: 1 } }, { game: 'yugioh' });
    assert.equal(getCachedScan('Dark Magician', 'yugioh').prices.en, 1);
  });

  test('partial scans are never cached', () => {
    setCachedScan('Umbreon ex', 'pokemon', { _truncated: true, prices: { en: 10 } }, RICH);
    assert.equal(getCachedScan('Umbreon ex', 'pokemon', RICH), null);
  });

  test('old exact-print cache hits cannot revive a broad card price in prose', () => {
    const pin = {
      id: '32807846', printingId: '32807846:L26D-ENS08', game: 'yugioh',
    };
    setCachedScan('Reinforcement of the Army', 'yugioh', {
      _pin: pin,
      prices: { en_price: '' },
      summary: 'The all-printing market price of $0.13 is misleading.',
      signals: [],
    }, pin);
    const hit = getCachedScan('Reinforcement of the Army', 'yugioh', pin);
    assert.doesNotMatch(hit.summary, /\$0\.13/);
    assert.match(hit.summary, /broad card-level pricing/i);
  });
});
