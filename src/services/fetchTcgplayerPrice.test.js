import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { addTcgplayerPrice, selectTcgplayerPrice } from './fetchTcgplayerPrice.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const printing = {
  name: 'Fydraulis Harmonia',
  game: 'yugioh',
  setName: 'Blazing Dominion',
  number: 'BLZD-EN024',
  rarity: 'Starlight Rare',
  price: null,
};

const secret = {
  productId: 692266,
  productName: 'Fydraulis Harmonia',
  setName: 'Blazing Dominion',
  rarityName: 'Secret Rare',
  marketPrice: 90.80,
  customAttributes: { number: 'BLZD-EN024' },
};

const starlight = {
  productId: 692267,
  productName: 'Fydraulis Harmonia (Starlight Rare)',
  setName: 'Blazing Dominion',
  rarityName: 'Starlight Rare',
  marketPrice: 175.54,
  lowestPrice: 159.89,
  medianPrice: 180.55,
  customAttributes: { number: 'BLZD-EN024' },
};

describe('TCGplayer exact-print price', () => {
  test('chooses the matching rarity instead of the cheaper same-code card', () => {
    const result = selectTcgplayerPrice([secret, starlight], printing);
    assert.deepEqual(result, {
      price: 175.54,
      low: 159.89,
      median: 180.55,
      source: 'TCGplayer',
      productId: 692267,
      url: 'https://www.tcgplayer.com/product/692267',
    });
  });

  test('refuses a price when the exact rarity is absent', () => {
    assert.equal(selectTcgplayerPrice([secret], printing), null);
  });

  test('adds the exact market price to an unpriced scan pin', async () => {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/autocomplete')) {
        return {
          ok: true,
          async json() {
            return { products: [
              { 'product-id': 692266, 'set-name': 'Blazing Dominion' },
              { 'product-id': 692267, 'set-name': 'Blazing Dominion' },
            ] };
          },
        };
      }
      const detail = String(url).includes('/692267/') ? starlight : secret;
      return { ok: true, async json() { return detail; } };
    };

    const result = await addTcgplayerPrice(printing);
    assert.equal(result.price, 175.54);
    assert.equal(result.priceSource, 'TCGplayer');
    assert.equal(result.tcgplayerProductId, 692267);
  });
});
