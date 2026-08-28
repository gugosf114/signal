import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { validateCardIdentification } from './scanCardImage.js';

describe('vision result validation', () => {
  test('keeps only supported enums and bounded text', () => {
    const out = validateCardIdentification({
      name: '  Charizard ex\u0000 ', game: 'baseball', set: 17,
      number: ' 199/198 ', confidence: 'certain', notes: ' blurry ',
    });
    assert.deepEqual(out, {
      name: 'Charizard ex', game: null, set: null, number: '199/198',
      passcode: null, rarity: null, confidence: 'low', notes: 'blurry',
    });
  });

  test('recovers a modern set code from the model notes', () => {
    const out = validateCardIdentification({
      name: 'Reinforcement of the Army', game: 'Yu-Gi-Oh!', set: 'Unknown',
      number: 'Unable to read clearly', code: 'L26D-ENS08', confidence: 0.9,
      notes: 'Code visible as L26D-ENS08.',
    });
    assert.equal(out.game, 'yugioh');
    assert.equal(out.number, 'L26D-ENS08');
    assert.equal(out.confidence, 'high');
  });

  test('separates a Yu-Gi-Oh passcode from its exact printing code and rarity', () => {
    const out = validateCardIdentification({
      name: 'Hydraulis Harmonia', game: 'yugioh', set: 'Unknown',
      number: '70088809', passcode: '70088809', rarity: 'Starlight Rare',
      confidence: 'high', notes: 'The lower-right set code is blurred.',
    });
    assert.equal(out.number, null);
    assert.equal(out.passcode, '70088809');
    assert.equal(out.rarity, 'Starlight Rare');
  });
});
