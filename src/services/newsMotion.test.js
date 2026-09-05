import test from 'node:test';
import assert from 'node:assert/strict';
import { centeredNewsIndex, centeredNewsPosition } from './newsMotion.js';

test('news foil follows the card nearest the middle, not the card leaving on the left', () => {
  assert.equal(centeredNewsIndex(0, 356, 6), 0);
  assert.equal(centeredNewsIndex(80, 356, 6), 1);
  assert.equal(centeredNewsIndex(191, 356, 6), 1);
  assert.equal(centeredNewsIndex(272, 356, 6), 2);
});

test('news foil selection wraps cleanly through the looping track', () => {
  const total = 6 * (178 + 14);
  assert.equal(centeredNewsIndex(total - 10, 356, 6), 0);
});

test('jumping to a dot centers that article and keeps it active', () => {
  for (let index = 0; index < 6; index += 1) {
    const position = centeredNewsPosition(index, 356, 6);
    assert.equal(centeredNewsIndex(position, 356, 6), index);
  }
});
