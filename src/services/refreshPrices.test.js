import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { pricePatchFromCardData } from './refreshPrices.js';

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
});
