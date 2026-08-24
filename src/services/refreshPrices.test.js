import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { pricePatchFromCardData } from './refreshPrices.js';

describe('cached price refresh', () => {
  test('clears a stale broad price when the exact print has no price', () => {
    assert.deepEqual(pricePatchFromCardData({
      priceLines: null,
      priceScope: 'exact-print price unavailable',
    }), { en_price: '' });
  });

  test('keeps a real exact market price', () => {
    assert.deepEqual(pricePatchFromCardData({
      priceLines: ['Market price: $18.00'],
      priceScope: 'set-code printing',
    }), { en_price: '$18.00' });
  });
});
