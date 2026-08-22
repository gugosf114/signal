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
      confidence: 'low', notes: 'blurry',
    });
  });
});
