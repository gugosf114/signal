import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchCardData } from './fetchCardData.js';

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
          { set_name: 'Legendary Decks II', set_code: 'LDK2-ENJ01', set_rarity: 'Common' },
        ],
      }],
    });

    const result = await fetchCardData('Blue-Eyes White Dragon', 'yugioh', {
      id: '89631139', game: 'yugioh', setName: 'Legendary Decks II',
      setId: 'LDK2-ENJ01', number: 'LDK2-ENJ01',
    });

    assert.equal(result.setName, 'Legendary Decks II');
    assert.equal(result.number, 'LDK2-ENJ01');
    assert.equal(result.rarity, 'Common');
    assert.equal(result.printingId, '89631139:LDK2-ENJ01');
    assert.match(result.priceLines[0], /all printings/i);
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
