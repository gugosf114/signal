import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addTcgplayerPrice,
  baseTcgplayerName,
  selectTcgplayerPrice,
  tcgplayerProductRow,
  tcgplayerProductImageUrl,
} from './fetchTcgplayerPrice.js';

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

const platinum = {
  productId: 524687,
  productName: 'Reinforcement of the Army (Platinum Secret Rare)',
  setName: '25th Anniversary Rarity Collection',
  rarityName: 'Platinum Secret Rare',
  marketPrice: 5.08,
  customAttributes: { number: 'RA01-EN051' },
};

const collector = {
  productId: 524691,
  productName: 'Reinforcement of the Army (PCR)',
  setName: '25th Anniversary Rarity Collection',
  rarityName: "Prismatic Collector's Rare",
  marketPrice: 1.25,
  customAttributes: { number: 'RA01-EN051' },
};

const ultimate = {
  productId: 524690,
  productName: 'Reinforcement of the Army (PUR)',
  setName: '25th Anniversary Rarity Collection',
  rarityName: 'Prismatic Ultimate Rare',
  marketPrice: 2.13,
  customAttributes: { number: 'RA01-EN051' },
};

const ra01Secret = {
  productId: 524686,
  productName: 'Reinforcement of the Army (Secret Rare)',
  setName: '25th Anniversary Rarity Collection',
  rarityName: 'Secret Rare',
  marketPrice: 1.03,
  customAttributes: { number: 'RA01-EN051' },
};

const l26dStarlight = {
  productId: 683013,
  productName: 'Reinforcement of the Army (Alternate Art) (Starlight Rare)',
  setName: 'Legendary Modern Decks 2026',
  rarityName: 'Starlight Rare',
  marketPrice: 262.45,
  customAttributes: { number: 'L26D-ENS08' },
};

describe('TCGplayer exact-print price', () => {
  test('keeps standard, extended-art, and Starlight products separate', () => {
    const standard = tcgplayerProductRow({
      productId: 702445, productName: 'Witness of the Ancient', setName: 'Chaos Origins',
      number: 'CORI-EN081', rarityName: 'Ultra Rare', marketPrice: 1.86,
    });
    const extended = tcgplayerProductRow({
      productId: 702446, productName: 'Witness of the Ancient (Extended Art)', setName: 'Chaos Origins',
      number: 'CORI-EN081', rarityName: 'Ultra Rare', marketPrice: 10.67,
    });
    const starlight = tcgplayerProductRow({
      productId: 702447, productName: 'Witness of the Ancient (Starlight Rare) (Extended Art)', setName: 'Chaos Origins',
      number: 'CORI-EN081', rarityName: 'Starlight Rare', marketPrice: 63.76,
    });
    assert.deepEqual([standard, extended, starlight].map((row) => row.printingId), [
      'tcgplayer:702445', 'tcgplayer:702446', 'tcgplayer:702447',
    ]);
    assert.deepEqual([standard, extended, starlight].map((row) => row.price), [1.86, 10.67, 63.76]);
    assert.equal(extended.imageUrl, 'https://product-images.tcgplayer.com/702446.jpg');
    assert.equal(baseTcgplayerName(starlight.name), 'Witness of the Ancient');
  });

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
      if (String(url).includes('/search/request')) {
        return {
          ok: true,
          async json() { return { results: [{ results: [secret, starlight] }] }; },
        };
      }
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
    assert.equal(result.tcgplayerImageUrl, 'https://product-images.tcgplayer.com/692267.jpg');
  });

  test('reads parenthetical rarity products from Rarity Collection', () => {
    const result = selectTcgplayerPrice([platinum], {
      name: 'Reinforcement of the Army',
      game: 'yugioh',
      setName: '25th Anniversary Rarity Collection',
      number: 'RA01-EN051',
      rarity: 'Platinum Secret Rare',
    });
    assert.equal(result?.price, 5.08);
    assert.equal(result?.productId, 524687);
  });

  test("matches YGOPRODeck Collector's Rare to TCGplayer's Prismatic name", () => {
    const result = selectTcgplayerPrice([collector], {
      name: 'Reinforcement of the Army',
      game: 'yugioh',
      setName: '25th Anniversary Rarity Collection',
      number: 'RA01-EN051',
      rarity: "Collector's Rare",
    });
    assert.equal(result?.price, 1.25);
    assert.equal(result?.productId, 524691);
  });

  test("matches YGOPRODeck Ultimate Rare to TCGplayer's Prismatic name", () => {
    const result = selectTcgplayerPrice([ultimate], {
      name: 'Reinforcement of the Army',
      game: 'yugioh',
      setName: '25th Anniversary Rarity Collection',
      number: 'RA01-EN051',
      rarity: 'Ultimate Rare',
    });
    assert.equal(result?.price, 2.13);
    assert.equal(result?.productId, 524690);
  });

  test('marketplace search recovers duplicate-name products hidden by autocomplete', async () => {
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls += 1;
      assert.match(String(url), /\/search\/request/);
      return {
        ok: true,
        async json() { return { results: [{ results: [ra01Secret] }] }; },
      };
    };
    const result = await addTcgplayerPrice({
      name: 'Reinforcement of the Army',
      game: 'yugioh',
      setName: '25th Anniversary Rarity Collection',
      number: 'RA01-EN051',
      rarity: 'Secret Rare',
      price: null,
    });
    assert.equal(result.price, 1.03);
    assert.equal(result.tcgplayerProductId, 524686);
    assert.equal(calls, 1);
  });

  test('matches alternate-art and rarity labels on the photographed L26D card', () => {
    const result = selectTcgplayerPrice([l26dStarlight], {
      name: 'Reinforcement of the Army',
      game: 'yugioh',
      setName: 'Legendary Modern Decks 2026',
      number: 'L26D-ENS08',
      rarity: 'Starlight Rare',
    });
    assert.equal(result?.price, 262.45);
    assert.equal(result?.productId, 683013);
  });

  test('a priced L26D pin still fetches its exact clean product image', async () => {
    globalThis.fetch = async (url) => {
      assert.match(String(url), /\/search\/request/);
      return {
        ok: true,
        async json() { return { results: [{ results: [l26dStarlight] }] }; },
      };
    };
    const result = await addTcgplayerPrice({
      name: 'Reinforcement of the Army',
      game: 'yugioh',
      setName: 'Legendary Modern Decks 2026',
      number: 'L26D-ENS08',
      rarity: 'Starlight Rare',
      price: 262.45,
    }, undefined, { requireProductId: true });
    assert.equal(result.tcgplayerProductId, 683013);
    assert.equal(result.tcgplayerImageUrl, 'https://product-images.tcgplayer.com/683013.jpg');
    assert.equal(tcgplayerProductImageUrl(683013), result.tcgplayerImageUrl);
  });
});
