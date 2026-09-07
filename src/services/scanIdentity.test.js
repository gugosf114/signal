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
    assert.equal(isExactScanTarget('pokemon', { name: 'Rayquaza-EX', game: 'pokemon', printingId: 'xy6-104', setName: 'Roaring Skies', number: '104', form: 'holo' }), true);
    assert.equal(isExactScanTarget('mtg', { name: 'Optimus Prime, Hero', game: 'mtg', printingId: 'f04ed2cc', setName: 'Transformers', number: '13', form: 'normal' }), true);
    assert.equal(isExactScanTarget('yugioh', { name: 'Heat Wave', game: 'yugioh', printingId: 'tcgplayer:592579', setName: 'Quarter Century Bonanza', number: 'RA03-EN058' }), true);
  });

  test('rejects an unknown game even when it has an id', () => {
    assert.equal(isExactScanTarget('sports', { printingId: '123' }), false);
  });

  test('rejects a pin from another game', () => {
    assert.equal(isExactScanTarget('pokemon', { name: 'X', game: 'mtg', printingId: 'same-looking-id', setName: 'Set', number: '1', form: 'normal' }), false);
  });

  test('rejects an id that lost its set or printed number', () => {
    assert.equal(isExactScanTarget('pokemon', { name: 'Rayquaza-EX', game: 'pokemon', printingId: 'xy6-104', form: 'holo' }), false);
  });
});
