import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isExactScanTarget } from './scanIdentity.js';

describe('one paid-scan identity gate', () => {
  test('rejects broad names in every game', () => {
    for (const game of ['pokemon', 'mtg', 'yugioh']) {
      assert.equal(isExactScanTarget(game, null), false);
      assert.equal(isExactScanTarget(game, { game }), false);
    }
  });

  test('accepts exact catalogue printings in every game', () => {
    assert.equal(isExactScanTarget('pokemon', { game: 'pokemon', printingId: 'xy6-104', form: 'holo' }), true);
    assert.equal(isExactScanTarget('mtg', { game: 'mtg', printingId: 'f04ed2cc', form: 'normal' }), true);
    assert.equal(isExactScanTarget('yugioh', { game: 'yugioh', printingId: 'tcgplayer:592579' }), true);
  });

  test('rejects an unknown game even when it has an id', () => {
    assert.equal(isExactScanTarget('sports', { printingId: '123' }), false);
  });

  test('rejects a pin from another game', () => {
    assert.equal(isExactScanTarget('pokemon', { game: 'mtg', printingId: 'same-looking-id' }), false);
  });
});
