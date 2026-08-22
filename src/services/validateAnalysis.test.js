import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { SIGNAL_KEYS } from '../config/signals.js';
import { normalizeAnalysis } from './validateAnalysis.js';

const signal = (key, extra = {}) => ({ key, level: 3, detail: 'ok', sources: [], ...extra });

describe('normalizeAnalysis', () => {
  test('clamps model values, removes duplicates, and marks missing signals partial', () => {
    const out = normalizeAnalysis({
      card_name: 'wrong card',
      game: 'pokemon',
      signals: [signal('creator', { level: 99 }), signal('creator'), signal('not-real')],
    }, { cardName: 'Exact Card', game: 'pokemon', now: 0 });
    assert.equal(out.card_name, 'Exact Card');
    assert.equal(out.signals.length, 1);
    assert.equal(out.signals[0].level, 5);
    assert.equal(out._truncated, true);
    assert.equal(out._scannedAt, '1970-01-01T00:00:00.000Z');
  });

  test('a complete eight-signal response stays complete', () => {
    const out = normalizeAnalysis({ signals: SIGNAL_KEYS.map((key) => signal(key)) }, { game: 'mtg' });
    assert.equal(out.signals.length, 8);
    assert.equal(out._truncated, false);
  });

  test('sanitizes source enums and refuses model-invented grading math', () => {
    const out = normalizeAnalysis({
      signals: SIGNAL_KEYS.map((key) => signal(key, {
        sources: [{ type: 'made-up', implication: 'moon', reach: 'huge', url: 'https://real.example/x' }],
      })),
      grading_roi: { raw_price_usd: 10, psa10_est_usd: 1000, verdict: 'worth_grading' },
    }, { game: 'pokemon' });
    assert.equal(out.signals[0].sources[0].type, 'other');
    assert.equal(out.signals[0].sources[0].implication, 'neutral');
    assert.equal(out.grading_roi.verdict, 'insufficient_data');
  });

  test('normalizes alignment without treating disagree as agree', () => {
    const out = normalizeAnalysis({
      prices: { signal_vs_market: 'signals disagree with price' },
      signals: SIGNAL_KEYS.map((key) => signal(key)),
    }, { game: 'pokemon' });
    assert.equal(out.prices.signal_vs_market, 'disagree');
  });
});
