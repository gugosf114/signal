import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { pricePatchFromCardData, pricePatchFromTcgplayer, refreshPrices } from './refreshPrices.js';

describe('cached price refresh', () => {
  test('clears a stale broad price when the exact print has no price', () => {
    const patch = pricePatchFromCardData({
      priceLines: null,
      priceScope: 'exact-print price unavailable',
    });
    assert.equal(patch.en_price, '');
    assert.equal(patch.price_source, '');
    assert.ok(patch.price_checked_at);
  });

  test('keeps a real exact market price', () => {
    const patch = pricePatchFromCardData({
      priceLines: ['Market price: $18.00'],
      priceScope: 'set-code printing',
      priceSource: 'YGOPRODeck',
    });
    assert.equal(patch.en_price, '$18.00');
    assert.equal(patch.price_source, 'YGOPRODeck');
    assert.ok(patch.price_checked_at);
  });

  test('turns an exact TCGplayer product into the saved-card patch', () => {
    const patch = pricePatchFromTcgplayer({
      price: 262.45,
      source: 'TCGplayer',
      productId: 683013,
      url: 'https://www.tcgplayer.com/product/683013',
    });
    assert.equal(patch.en_price, '$262.45');
    assert.equal(patch.price_source, 'TCGplayer');
    assert.equal(patch.tcgplayer_product_id, 683013);
    assert.equal(patch.price_url, 'https://www.tcgplayer.com/product/683013');
  });

  test('saved Yu-Gi-Oh refresh asks the exact TCGplayer route first', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes('mp-search-api.tcgplayer.com/v1/search/request')) {
        return {
          ok: true,
          json: async () => ({ results: [{ results: [{
            productName: 'Reinforcement of the Army',
            setName: 'Legendary Modern Decks 2026',
            number: 'L26D-ENS08',
            rarityName: 'Starlight Rare',
            marketPrice: 262.45,
            lowestPrice: 259.64,
            medianPrice: 267.145,
            productId: 683013,
          }] }] }),
        };
      }
      throw new Error(`Unexpected broad fallback: ${url}`);
    };
    try {
      const patch = await refreshPrices('Reinforcement of the Army', 'yugioh', {
        name: 'Reinforcement of the Army',
        game: 'yugioh',
        printingId: '32807846:L26D-ENS08',
        id: '32807846',
        setName: 'Legendary Modern Decks 2026',
        number: 'L26D-ENS08',
        rarity: 'Starlight Rare',
      });
      assert.equal(patch.en_price, '$262.45');
      assert.equal(calls.length, 1);
      assert.match(calls[0], /mp-search-api\.tcgplayer\.com/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('saved Pokémon refresh asks the exact TCGplayer printing first', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes('mp-search-api.tcgplayer.com/v1/search/request')) {
        return {
          ok: true,
          json: async () => ({ results: [{ results: [{
            productName: 'Mega Clefable ex',
            setName: 'Perfect Order',
            number: '119/088',
            rarityName: 'Special Illustration Rare',
            marketPrice: 50.71,
            lowestPrice: 46,
            productId: 684385,
          }] }] }),
        };
      }
      throw new Error(`Unexpected broad fallback: ${url}`);
    };
    try {
      const patch = await refreshPrices('Mega Clefable ex', 'pokemon', {
        name: 'Mega Clefable ex',
        game: 'pokemon',
        printingId: 'me3-119',
        id: 'me3-119',
        setName: 'Perfect Order',
        number: '119',
        rarity: 'Special Illustration Rare',
        form: 'normal',
        finish: 'Normal',
      });
      assert.equal(patch.en_price, '$50.71');
      assert.equal(patch.tcgplayer_product_id, 684385);
      assert.equal(calls.length, 1);
      assert.match(calls[0], /mp-search-api\.tcgplayer\.com/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
