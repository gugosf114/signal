import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cardNumberEndsWith, fetchYgoPrintingsByPasscode, parseCardLookupQuery, resolvePrinting,
  searchCardsByName, selectRecentYugiohSets, suggestCards, ygoPrintingRows,
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

const reinforcement = {
  id: 32807846,
  name: 'Reinforcement of the Army',
  card_prices: [{ tcgplayer_price: '0.13' }],
  card_images: [{ image_url: 'rota.jpg', image_url_small: 'rota-small.jpg' }],
  card_sets: ['Common', 'Secret Rare', 'Starlight Rare'].map((set_rarity) => ({
    set_name: 'Legendary Modern Decks 2026',
    set_code: 'L26D-ENS08',
    set_rarity,
    set_price: '0',
  })),
};

const fydraulis = {
  id: 70088809,
  name: 'Fydraulis Harmonia',
  card_prices: [{ tcgplayer_price: '90.80' }],
  card_images: [{ image_url: 'fydraulis.jpg', image_url_small: 'fydraulis-small.jpg' }],
  card_sets: [
    { set_name: 'Blazing Dominion', set_code: 'BLZD-EN024', set_rarity: 'Secret Rare', set_price: '0' },
    { set_name: 'Blazing Dominion', set_code: 'BLZD-EN024', set_rarity: 'Starlight Rare', set_price: '0' },
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

  test('an exact row with no exact price does not inherit the broad card price', () => {
    const rows = ygoPrintingRows(reinforcement);
    assert.equal(rows[2].number, 'L26D-ENS08');
    assert.equal(rows[2].rarity, 'Starlight Rare');
    assert.equal(rows[2].price, null);
    assert.equal(rows[2].priceScope, 'exact-print price unavailable');
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

describe('live expansion shelf', () => {
  test('keeps twelve recent sets so a month-old release is not pushed off the shelf', () => {
    const data = Array.from({ length: 11 }, (_, index) => ({
      set_name: `Newer ${index}`,
      set_code: `N${index}`,
      num_of_cards: 50,
      tcg_date: `2026-${String(8 - Math.floor(index / 4)).padStart(2, '0')}-${String(22 - index).padStart(2, '0')}`,
    }));
    data.push({
      set_name: 'Legendary Modern Decks 2026', set_code: 'L26D',
      num_of_cards: 111, tcg_date: '2026-04-23',
    });
    const sets = selectRecentYugiohSets(data, '2026-08-23');
    assert.equal(sets.length, 12);
    assert.equal(sets.some((set) => set.code === 'L26D'), true);
  });
});

describe('camera printing resolution', () => {
  test('a Yu-Gi-Oh passcode and foil rarity repair a wrong OCR name', async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('cardinfo.php?id=70088809')) {
        return { ok: true, status: 200, async json() { return { data: [fydraulis] }; } };
      }
      return { ok: false, status: 400, async json() { return {}; } };
    };

    const hit = await resolvePrinting({
      name: 'Hydraulis Harmonia', game: 'yugioh', set: 'Unknown',
      number: null, passcode: '70088809', rarity: 'Starlight Rare',
    });

    assert.equal(hit?.name, 'Fydraulis Harmonia');
    assert.equal(hit?.number, 'BLZD-EN024');
    assert.equal(hit?.rarity, 'Starlight Rare');
  });

  test('Search matches expands a passcode into every real printing', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { data: [fydraulis] }; },
    });
    const rows = await fetchYgoPrintingsByPasscode('70088809');
    const suggestions = await suggestCards('70088809');
    assert.equal(rows.length, 2);
    assert.deepEqual(suggestions.map((row) => row.rarity), ['Secret Rare', 'Starlight Rare']);
  });

  test('an exact full set code corrects a foil-misread card name', async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('setcode=BLZD-EN024')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: 70088809,
              name: 'Fydraulis Harmonia',
              set_name: 'Blazing Dominion',
              set_code: 'BLZD-EN024',
              set_rarity: 'Starlight Rare',
              set_price: '0',
            };
          },
        };
      }
      return { ok: false, status: 400, async json() { return {}; } };
    };

    const hit = await resolvePrinting({
      name: 'Hydradius Harmonia', game: 'yugioh',
      set: 'BLZD', number: 'BLZD-EN024',
    });

    assert.equal(hit?.name, 'Fydraulis Harmonia');
    assert.equal(hit?.number, 'BLZD-EN024');
    assert.equal(hit?.rarity, 'Starlight Rare');
  });

  test('repairs one I/L OCR error through one exact-name catalogue match', async () => {
    const requested = [];
    globalThis.fetch = async (url) => {
      requested.push(String(url));
      if (String(url).includes('setcode=I26D-ENS08')) {
        return { ok: false, status: 400, async json() { return {}; } };
      }
      if (String(url).includes('setcode=L26D-ENS08')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: reinforcement.id,
              name: reinforcement.name,
              set_name: 'Legendary Modern Decks 2026',
              set_code: 'L26D-ENS08',
              set_rarity: 'Starlight Rare',
              set_price: '0',
            };
          },
        };
      }
      if (String(url).includes('cardinfo.php?name=')) {
        return { ok: true, status: 200, async json() { return { data: [reinforcement] }; } };
      }
      return { ok: false, status: 400, async json() { return {}; } };
    };

    const hit = await resolvePrinting({
      name: 'Reinforcement of the Army', game: 'yugioh',
      set: null, number: 'I26D-ENS08',
    });

    assert.equal(hit?.number, 'L26D-ENS08');
    assert.equal(hit?.rarity, 'Starlight Rare');
    assert.equal(requested.some((url) => url.includes('cardinfo.php?name=')), true);
  });

  test('refuses a wider set-code guess after the direct lookup misses', async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('cardsetsinfo.php')) {
        return { ok: false, status: 400, async json() { return {}; } };
      }
      if (String(url).includes('cardinfo.php?name=')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              data: [{
                ...reinforcement,
                card_sets: [{
                  ...reinforcement.card_sets[0],
                  set_code: 'P26D-ENS08',
                }],
              }],
            };
          },
        };
      }
      return { ok: false, status: 400, async json() { return {}; } };
    };

    const hit = await resolvePrinting({
      name: 'Reinforcement of the Army', game: 'yugioh',
      set: null, number: 'I26D-ENS08',
    });

    assert.equal(hit, null);
  });

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

  test('a unique exact-name card resolves even when glare hides its code', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { data: [{
          id: 79015062,
          name: 'A.I. Connect',
          card_prices: [{ tcgplayer_price: '0.00' }],
          card_images: [{ image_url: 'ai.jpg', image_url_small: 'ai-small.jpg' }],
          card_sets: [{ set_name: 'Alliance Insight', set_code: 'ALIN-EN054', set_rarity: 'Super Rare' }],
        }] };
      },
    });
    const hit = await resolvePrinting({ name: 'A.I. Connect', game: 'yugioh', set: 'Unknown', number: null });
    assert.equal(hit?.number, 'ALIN-EN054');
  });

  test('a recovered full code wins even when the model calls the set unknown', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { data: [blueEyes] }; },
    });
    const hit = await resolvePrinting({
      name: 'Blue-Eyes White Dragon', game: 'yugioh',
      set: 'Unknown', number: 'LOB-EN001',
    });
    assert.equal(hit?.number, 'LOB-EN001');
  });
});
