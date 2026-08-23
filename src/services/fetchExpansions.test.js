import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cardNumberEndsWith, parseCardLookupQuery, resolvePrinting,
  searchCardsByName, ygoPrintingRows,
} from './fetchExpansions.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const blueEyes = {
  id: 89631139,
  name: 'Blue-Eyes White Dragon',
  card_prices: [{ tcgplayer_price: '7.25' }],
  card_images: [{ image_url: 'large.jpg', image_url_small: 'small.jpg' }],
  card_sets: [
    { set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-EN001', set_rarity: 'Ultra Rare', set_price: '253.34' },
    { set_name: 'Legendary Decks II', set_code: 'LDK2-ENJ01', set_rarity: 'Common', set_price: '7.80' },
  ],
};

describe('Yu-Gi-Oh printing rows', () => {
  test('one card-level id expands into distinct printing identities', () => {
    const rows = ygoPrintingRows(blueEyes);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.printingId), [
      '89631139:LOB-EN001',
      '89631139:LDK2-ENJ01',
    ]);
    assert.equal(rows[1].rarity, 'Common');
    assert.equal(rows[0].price, 253.34);
    assert.equal(rows[0].priceScope, 'set-code printing');
  });

  test('set browsing keeps only the printing from that set', () => {
    const rows = ygoPrintingRows(blueEyes, { name: 'Legendary Decks II', code: 'LDK2' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].number, 'LDK2-ENJ01');
  });
});

describe('short name + last digits lookup', () => {
  test('splits a first word from the visible card-number suffix', () => {
    assert.deepEqual(parseCardLookupQuery('Captain 123'), { name: 'Captain', numberSuffix: '123' });
    assert.deepEqual(parseCardLookupQuery('Blue-Eyes 001'), { name: 'Blue-Eyes', numberSuffix: '001' });
    assert.deepEqual(parseCardLookupQuery('123'), { name: '', numberSuffix: '123' });
    assert.deepEqual(parseCardLookupQuery('Blue-Eyes White Dragon'), { name: 'Blue-Eyes White Dragon', numberSuffix: null });
  });

  test('matches the last printed digits without confusing 001 and 101', () => {
    assert.equal(cardNumberEndsWith('LOB-EN001', '001'), true);
    assert.equal(cardNumberEndsWith('LOB-EN101', '001'), false);
    assert.equal(cardNumberEndsWith('LDK2-ENJ01', '001'), false);
    assert.equal(cardNumberEndsWith('25', '025'), true);
    assert.equal(cardNumberEndsWith('199/198', '198'), true);
  });

  test('filters catalogue results by the typed suffix', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { data: [blueEyes] }; },
    });
    const rows = await searchCardsByName('yugioh', 'Blue-Eyes 001');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].number, 'LOB-EN001');
  });
});

describe('camera printing resolution', () => {
  test('number and set must match the same printing', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { data: [blueEyes] }; },
    });

    const wrongPair = await resolvePrinting({
      name: 'Blue-Eyes White Dragon', game: 'yugioh', number: '002', set: 'Legendary Decks II',
    });
    assert.equal(wrongPair, null);

    const exact = await resolvePrinting({
      name: 'Blue-Eyes White Dragon', game: 'yugioh', number: '01', set: 'Legendary Decks II',
    });
    assert.equal(exact?.printingId, '89631139:LDK2-ENJ01');
  });
});
