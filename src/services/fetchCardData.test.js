import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyTrustedMarketPrice,
  applyTrustedPinMarketPrice,
  applyTrustedPriceNarrative,
  fetchCardData,
} from './fetchCardData.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

describe('fetchCardData exact-print contract', () => {
  test('a trusted TCGplayer fallback becomes the exact report price', () => {
    const cardData = applyTrustedPinMarketPrice({
      name: 'Fydraulis Harmonia',
      priceLines: null,
      priceScope: 'exact-print price unavailable',
    }, {
      price: 175.54,
      priceSource: 'TCGplayer',
      priceUrl: 'https://www.tcgplayer.com/product/692267',
    });

    assert.deepEqual(cardData.priceLines, ['TCGplayer exact-print market price: $175.54']);
    assert.equal(cardData.priceScope, 'exact-print TCGplayer market price');
    assert.equal(applyTrustedMarketPrice({}, cardData, 175.54).en_price, '$175.54');
  });

  test('a dead pin does not fall back to a different name match', async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return response(404, {});
    };

    const result = await fetchCardData('Charizard ex', 'pokemon', {
      id: 'sv8pt5-161', game: 'pokemon', setName: 'Prismatic Evolutions', number: '161',
    });

    assert.equal(result, null);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /cards\/sv8pt5-161$/);
  });

  test('a Yu-Gi-Oh pin selects its exact set printing, not card_sets[0]', async () => {
    globalThis.fetch = async () => response(200, {
      data: [{
        id: 89631139,
        name: 'Blue-Eyes White Dragon',
        card_prices: [{ tcgplayer_price: '7.25' }],
        card_images: [{ image_url: 'https://img.example.com/blue-eyes.jpg' }],
        card_sets: [
          { set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-EN001', set_rarity: 'Ultra Rare' },
          { set_name: 'Legendary Decks II', set_code: 'LDK2-ENJ01', set_rarity: 'Secret Rare', set_price: '18.00' },
          { set_name: 'Legendary Decks II', set_code: 'LDK2-ENJ01', set_rarity: 'Common', set_price: '8.40' },
        ],
      }],
    });

    const result = await fetchCardData('Blue-Eyes White Dragon', 'yugioh', {
      id: '89631139', game: 'yugioh', setName: 'Legendary Decks II',
      setId: 'LDK2-ENJ01', number: 'LDK2-ENJ01', rarity: 'Common',
    });

    assert.equal(result.setName, 'Legendary Decks II');
    assert.equal(result.number, 'LDK2-ENJ01');
    assert.equal(result.rarity, 'Common');
    assert.equal(result.printingId, '89631139:LDK2-ENJ01');
    assert.equal(result.priceLines[0], 'Market price: $8.40');
    assert.equal(result.priceScope, 'set-code printing');
  });

  test('an exact Yu-Gi-Oh printing never inherits the cheap card-wide price', async () => {
    globalThis.fetch = async () => response(200, {
      data: [{
        id: 32807846,
        name: 'Reinforcement of the Army',
        card_prices: [{ tcgplayer_price: '0.13', cardmarket_price: '0.09' }],
        card_images: [{ image_url: 'https://img.example.com/rota.jpg' }],
        card_sets: [
          {
            set_name: 'Legendary Modern Decks 2026',
            set_code: 'L26D-ENS08',
            set_rarity: 'Starlight Rare',
            set_price: '0',
          },
        ],
      }],
    });

    const result = await fetchCardData('Reinforcement of the Army', 'yugioh', {
      id: '32807846', game: 'yugioh', setName: 'Legendary Modern Decks 2026',
      setId: 'L26D-ENS08', number: 'L26D-ENS08', rarity: 'Starlight Rare',
    });

    assert.equal(result.priceLines, null);
    assert.equal(result.priceScope, 'exact-print price unavailable');
    assert.equal(applyTrustedMarketPrice({ en_price: '$0.13' }, result, null).en_price, '');
    const cleaned = applyTrustedPriceNarrative({
      summary: 'Strong scarcity, though the all-printing market price of $0.13 is misleading.',
      signals: [{ detail: 'The market price is $0.13.', sources: [] }],
    }, result);
    assert.doesNotMatch(cleaned.summary, /\$0\.13/);
    assert.match(cleaned.summary, /broad card-level pricing/i);
    assert.doesNotMatch(cleaned.signals[0].detail, /\$0\.13/);
  });

  test('Pokemon suffixes remain part of an unpinned exact-name lookup', async () => {
    let requested = '';
    globalThis.fetch = async (url) => {
      requested = decodeURIComponent(String(url));
      return response(200, { data: [] });
    };
    await fetchCardData('Charizard ex', 'pokemon');
    assert.match(requested, /name:"Charizard ex"/);
  });
});
