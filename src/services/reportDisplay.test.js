import test from 'node:test';
import assert from 'node:assert/strict';
import { reportMarketPrice, reportHistoryMoves } from './reportDisplay.js';

test('market price accepts a single USD amount including zero', () => {
  assert.equal(reportMarketPrice('$1,234.56'), 1234.56);
  assert.equal(reportMarketPrice('USD 19.50'), 19.5);
  assert.equal(reportMarketPrice(0), 0);
});

test('missing prices, ranges, and invalid numbers never become a price', () => {
  for (const value of [null, undefined, '', 'No exact price', '$10 - $20', '€20', -1, Infinity]) assert.equal(reportMarketPrice(value), null);
});

test('an old agreement label without price history yields no history display', () => {
  assert.deepEqual(reportHistoryMoves({ signal_vs_market: 'agree' }), []);
  assert.deepEqual(reportHistoryMoves({ history: { change30: null, change90: null } }), []);
});

test('zero is a real move while absent or nonnumeric periods are omitted', () => {
  assert.deepEqual(reportHistoryMoves({ history: { change30: 0, change90: undefined } }), [{ label: '30-day move', value: 0 }]);
  assert.deepEqual(reportHistoryMoves({ history: { change30: 12.5, change90: -4.3 } }), [{ label: '30-day move', value: 12.5 }, { label: '90-day move', value: -4.3 }]);
  assert.deepEqual(reportHistoryMoves({ history: { change30: '12', change90: Infinity } }), []);
});
