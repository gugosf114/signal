import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cardBrowserRowKey, cardNumberEndsWith, expandFinishRows, fetchYgoPrintingsByPasscode, mtgRow,
  namesCompatibleForCode, normalizeCardBrowserResults, pokemonRow,
  parseCardLookupQuery, parseExpansionCache, resolvePrinting,
  resolvePrintingOptions, searchCardsByName, selectRecentMtgSets, selectRecentYugiohSets,
  selectRecentTcgDexPokemonSets, suggestCards, ygoPrintingRows,
} from './fetchExpansions.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('Pokémon and Magic finish rows', () => {
  test('Pokémon exposes every priced finish as its own choice', () => {
    const rows = expandFinishRows(pokemonRow({
      id: 'sv-test-1', name: 'Test Pokémon', number: '1', set: { id: 'sv-test', name: 'Test Set' },
      tcgplayer: { prices: {
        normal: { market: 2.25 }, holofoil: { market: 7.5 }, reverseHolofoil: { market: 4.75 },
      } },
      images: { small: 'small.jpg', large: 'large.jpg' },
    }));
    assert.deepEqual(rows.map((row) => [row.form, row.finish, row.price]), [
      ['normal', 'Normal', 2.25], ['holo', 'Holo', 7.5], ['reverse', 'Reverse Holo', 4.75],
    ]);
    assert.equal(new Set(rows.map(cardBrowserRowKey)).size, 3);
  });

  test('Magic exposes non-foil, foil, and etched as separate choices', () => {
    const rows = expandFinishRows(mtgRow({
      id: 'mtg-test-1', name: 'Test Mage', set: 'tst', set_name: 'Test Set', collector_number: '9',
      rarity: 'rare', finishes: ['nonfoil', 'foil', 'etched'],
      prices: { usd: '3.00', usd_foil: '8.50', usd_etched: '11.25' },
      image_uris: { small: 'small.jpg', large: 'large.jpg' },
    }));
    assert.deepEqual(rows.map((row) => [row.form, row.finish, row.price]), [
      ['normal', 'Non-foil', 3], ['foil', 'Foil', 8.5], ['etched', 'Etched', 11.25],
    ]);
    assert.equal(new Set(rows.map(cardBrowserRowKey)).size, 3);
  });
});

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

const witness = {
  id: 54577949,
  name: 'Witness of the Ancient',
  card_prices: [{ tcgplayer_price: '1.78' }],
  card_images: [{ image_url: 'wrong-base.jpg', image_url_small: 'wrong-base-small.jpg' }],
  card_sets: [
    { set_name: 'Chaos Origins', set_code: 'CORI-EN081', set_rarity: 'Ultra Rare', set_price: '0' },
    { set_name: 'Chaos Origins', set_code: 'CORI-EN081', set_rarity: 'Starlight Rare', set_price: '0' },
  ],
};

const witnessProducts = [
  { productId: 702445, productName: 'Witness of the Ancient', setName: 'Chaos Origins',
    number: 'CORI-EN081', rarityName: 'Ultra Rare', marketPrice: 1.86 },
  { productId: 702446, productName: 'Witness of the Ancient (Extended Art)', setName: 'Chaos Origins',
    number: 'CORI-EN081', rarityName: 'Ultra Rare', marketPrice: 10.67 },
  { productId: 702447, productName: 'Witness of the Ancient (Starlight Rare) (Extended Art)', setName: 'Chaos Origins',
    number: 'CORI-EN081', rarityName: 'Starlight Rare', marketPrice: 63.76 },
];

const chaosMagicalHats = {
  id: 150000001,
  name: 'Chaos Magical Hats',
  card_prices: [{ tcgplayer_price: '0.29' }],
  card_images: [{ image_url: 'chaos.jpg', image_url_small: 'chaos-small.jpg' }],
  card_sets: [
    { set_name: 'Chaos Origins', set_code: 'CORI-EN046', set_rarity: 'Super Rare', set_price: '0.29' },
    { set_name: 'Chaos Origins', set_code: 'CORI-EN046', set_rarity: 'Starlight Rare', set_price: '18.33' },
  ],
};

const chaosProducts = [
  { productId: 702408, productName: 'Chaos Magical Hats', setName: 'Chaos Origins',
    number: 'CORI-EN046', rarityName: 'Super Rare', marketPrice: 0.29 },
  { productId: 702409, productName: 'Chaos Magical Hats (Starlight Rare)', setName: 'Chaos Origins',
    number: 'CORI-EN046', rarityName: 'Starlight Rare', marketPrice: 18.33 },
];

const rarityCollectionReinforcement = {
  id: 32807846,
  name: 'Reinforcement of the Army',
  card_prices: [{ tcgplayer_price: '0.29' }],
  card_images: [{ image_url: 'ra01.jpg', image_url_small: 'ra01-small.jpg' }],
  card_sets: [
    "Collector's Rare",
    'Platinum Secret Rare',
    'Quarter Century Secret Rare',
    'Secret Rare',
    'Super Rare',
    'Ultimate Rare',
    'Ultra Rare',
  ].map((set_rarity) => ({
    set_name: '25th Anniversary Rarity Collection',
    set_code: 'RA01-EN051',
    set_rarity,
    set_price: '0',
  })),
};

describe('card browser game isolation', () => {
  test('removes duplicate old-game rows before Pokémon renders', () => {
    const stuckYugioh = {
      id: '22125101', printingId: '22125101:LAVD-ENO35', game: 'yugioh',
      name: 'Beyond the Pendulum', rarity: 'Common',
    };
    const pokemon = {
      id: 'me2-130', printingId: 'me2-130', game: 'pokemon',
      name: 'Mega Charizard X ex', rarity: 'Double Rare',
    };
    assert.deepEqual(
      normalizeCardBrowserResults([stuckYugioh, stuckYugioh, pokemon], 'pokemon'),
      [pokemon],
    );
  });

  test('keeps same-code Yu-Gi-Oh rarity variants under different keys', () => {
    const base = {
      id: '32807846', printingId: '32807846:L26D-ENS08', game: 'yugioh',
      name: 'Reinforcement of the Army',
    };
    const common = { ...base, rarity: 'Common' };
    const starlight = { ...base, rarity: 'Starlight Rare' };
    const rows = normalizeCardBrowserResults([common, starlight, starlight], 'yugioh');
    assert.equal(rows.length, 2);
    assert.notEqual(cardBrowserRowKey(common), cardBrowserRowKey(starlight));
  });
});

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
  test('the one-hour copy stays visible while a stale copy asks for an update', () => {
    const data = { pokemon: [{ id: 'me05' }], mtg: [{ id: 'hob' }], yugioh: [{ id: 'LAVD' }] };
    const fresh = parseExpansionCache(JSON.stringify({ ts: 1_000, data }), 1_000 + 30 * 60 * 1000);
    const stale = parseExpansionCache(JSON.stringify({ ts: 1_000, data }), 1_000 + 61 * 60 * 1000);
    assert.equal(fresh.fresh, true);
    assert.equal(stale.fresh, false);
    assert.deepEqual(stale.data, data);
  });

  test('Magic drops digital-only expansions that have no paper cards', () => {
    const sets = selectRecentMtgSets([
      { code: 'hob', name: 'The Hobbit', set_type: 'expansion', released_at: '2026-08-14', card_count: 300, digital: false },
      { code: 'om1', name: 'Through the Omenpaths', set_type: 'expansion', released_at: '2025-09-23', card_count: 188, digital: true },
      { code: 'eoe', name: 'Edge of Eternities', set_type: 'expansion', released_at: '2025-08-01', card_count: 250, digital: false },
    ], '2026-08-28');
    assert.deepEqual(sets.map((set) => set.id), ['hob', 'eoe']);
  });

  test('Pokemon keeps current physical sets and drops Pocket, promos, and future sets', () => {
    const physical = (id, name, releaseDate) => ({
      id, name, releaseDate, serie: { id: 'me' }, cardCount: { official: 80, total: 100 },
    });
    const sets = selectRecentTcgDexPokemonSets([
      physical('me05', 'Pitch Black', '2026-07-17'),
      physical('future', 'Future Set', '2026-09-01'),
      { ...physical('B2', 'Fantastical Parade', '2026-01-29'), serie: { id: 'tcgp' } },
      physical('mep', 'MEP Black Star Promos', '2025-09-26'),
      physical('mcd24', "McDonald's Collection 2024", '2024-12-04'),
      physical('sv08', 'Surging Sparks', '2024-11-08'),
    ], '2026-08-28');
    assert.deepEqual(sets.map((set) => set.id), ['me05', 'sv08']);
    assert.equal(sets[0].source, 'tcgdex');
  });

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
  test('an AI-guessed set cannot erase exact-name Magic printings', async () => {
    const lonelyMountain = {
      id: 'lonely-248', name: 'The Lonely Mountain', set: 'hob', set_name: 'The Hobbit',
      collector_number: '248', rarity: 'rare', finishes: ['nonfoil', 'foil'],
      prices: { usd: '21.76', usd_foil: '23.57', usd_etched: null },
      image_uris: { small: 'lonely-small.jpg', large: 'lonely-large.jpg' },
    };
    globalThis.fetch = async (_url, init = {}) => {
      const body = JSON.parse(init.body || '{}');
      if (body.action === 'catalogueFetch') {
        return {
          ok: true, status: 200,
          async json() {
            return { catalogue: true, ok: true, status: 200, data: { data: [lonelyMountain] } };
          },
        };
      }
      return { ok: false, status: 400, async json() { return {}; } };
    };
    const options = await resolvePrintingOptions({
      name: 'The Lonely Mountain', game: 'mtg', set: 'Wilds of Eldraine', number: null,
    });
    assert.deepEqual(options.map((row) => [row.setName, row.finish, row.price]), [
      ['The Hobbit', 'Non-foil', 21.76],
      ['The Hobbit', 'Foil', 23.57],
    ]);
  });

  test('one bad code letter cannot turn Chaos Magical Hats into an unrelated card', async () => {
    assert.equal(namesCompatibleForCode('Hydradius Harmonia', 'Fydraulis Harmonia'), true);
    assert.equal(namesCompatibleForCode('Chaos Magical Hats', "D/D/D Oracle King d'Arc"), false);
    globalThis.fetch = async (_url, init = {}) => {
      const body = JSON.parse(init.body || '{}');
      if (body.action === 'tcgplayerSearch') {
        return { ok: true, status: 200, async json() { return { products: chaosProducts }; } };
      }
      if (body.action === 'catalogueFetch') {
        return {
          ok: true, status: 200,
          async json() {
            return { catalogue: true, ok: true, status: 200, data: { data: [chaosMagicalHats] } };
          },
        };
      }
      return { ok: false, status: 400, async json() { return {}; } };
    };
    const options = await resolvePrintingOptions({
      name: 'Chaos Magical Hats', game: 'yugioh', number: 'CORE-EN046', set: 'Chaos Origins',
    });
    assert.deepEqual(options.map((row) => [row.name, row.number, row.price]), [
      ['Chaos Magical Hats', 'CORI-EN046', 0.29],
      ['Chaos Magical Hats (Starlight Rare)', 'CORI-EN046', 18.33],
    ]);
  });

  test('same-code full-art products keep their own image, price, and product id', async () => {
    globalThis.fetch = async (_url, init = {}) => {
      const body = JSON.parse(init.body || '{}');
      if (body.action === 'tcgplayerSearch') {
        return { ok: true, status: 200, async json() { return { products: witnessProducts }; } };
      }
      if (body.action === 'catalogueFetch') {
        return {
          ok: true,
          status: 200,
          async json() {
            return { catalogue: true, ok: true, status: 200, data: { data: [witness] } };
          },
        };
      }
      return { ok: false, status: 400, async json() { return {}; } };
    };
    const options = await resolvePrintingOptions({
      name: 'Witness of the Ancient', game: 'yugioh', number: 'CORI-EN081',
    });
    assert.deepEqual(options.map((row) => row.printingId), [
      'tcgplayer:702445', 'tcgplayer:702446', 'tcgplayer:702447',
    ]);
    assert.deepEqual(options.map((row) => row.price), [1.86, 10.67, 63.76]);
    assert.equal(options[1].imageUrl, 'https://product-images.tcgplayer.com/702446.jpg');
    assert.equal(options[1].id, '54577949');
  });

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

  test('scanner offers same-code rarities instead of guessing the foil', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { data: [fydraulis] }; },
    });
    const options = await resolvePrintingOptions({
      name: 'Hydraulis Harmonia', game: 'yugioh', set: 'Unknown',
      passcode: '70088809', rarity: 'Starlight Rare',
    });
    assert.deepEqual(options.map((row) => row.rarity), ['Secret Rare', 'Starlight Rare']);
    assert.notEqual(options[0].printingId, options[1].printingId);
  });

  test('one I/L camera error still opens the exact L26D printing choices', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { data: [reinforcement] }; },
    });
    const options = await resolvePrintingOptions({
      name: 'Reinforcement of the Army', game: 'yugioh',
      number: 'I26D-ENS08', set: 'Unknown',
    });
    assert.deepEqual(options.map((row) => row.rarity), ['Common', 'Secret Rare', 'Starlight Rare']);
    assert.equal(options.every((row) => row.number === 'L26D-ENS08'), true);
  });

  test('an unmatched photographed code never falls back to another set', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { data: [rarityCollectionReinforcement] }; },
    });
    const options = await resolvePrintingOptions({
      name: 'Reinforcement of the Army', game: 'yugioh',
      number: 'L26D-ENS08', set: 'Unknown',
    });
    assert.deepEqual(options, []);
  });

  test('an exact set code shows every real rarity instead of cutting off after three', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() { return { data: [rarityCollectionReinforcement] }; },
    });
    const options = await resolvePrintingOptions({
      name: 'Reinforcement of the Army', game: 'yugioh',
      number: 'RA01-EN051', set: 'Unknown',
    });
    assert.deepEqual(options.map((row) => row.rarity), [
      "Collector's Rare",
      'Platinum Secret Rare',
      'Quarter Century Secret Rare',
      'Secret Rare',
      'Super Rare',
      'Ultimate Rare',
      'Ultra Rare',
    ]);
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
