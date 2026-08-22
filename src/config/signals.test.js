// Tests for the weighted score, and specifically for direction.
//
// The bug these pin: the score used to read `level` alone, so a signal could be
// maxed out on purely bearish evidence and still push the score up. Umbreon ex
// scored 77 — SURGING, "real upward pressure" — off community volume that was
// backlash over scalping. Its own summary said "strong bearish signals." The
// price fell. The score could not tell excitement from a riot.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOverallScore,
  calculateScoreDetails,
  sourceDirection,
  directionMultiplier,
  SIGNAL_KEYS,
  SIGNAL_COUNT,
} from './signals.js';

const src = (...impls) => impls.map((implication) => ({ implication, url: 'https://x.test/a' }));

describe('sourceDirection', () => {
  test('reads the balance of bullish against bearish', () => {
    assert.equal(sourceDirection(src('up', 'up')), 1);
    assert.equal(sourceDirection(src('down', 'down')), -1);
    assert.equal(sourceDirection(src('up', 'down')), 0);
  });

  test('neutral sources and no sources both read as no lean', () => {
    assert.equal(sourceDirection(src('neutral', 'neutral')), 0);
    assert.equal(sourceDirection([]), 0);
    assert.equal(sourceDirection(undefined), 0);
  });

  test('neutrals do not dilute a lean', () => {
    // Two bearish and one neutral is still fully bearish evidence.
    assert.equal(sourceDirection(src('down', 'down', 'neutral')), -1);
  });
});

describe('directionMultiplier', () => {
  test('maps bearish, neutral, and bullish evidence onto a bounded factor', () => {
    assert.equal(directionMultiplier(src('up', 'up')), 1);
    assert.equal(directionMultiplier(src('neutral')), 0.5);
    assert.equal(directionMultiplier([]), 0.5);
    assert.equal(directionMultiplier(src('down', 'down')), 0);
    assert.equal(directionMultiplier(src('up', 'down', 'down', 'down')), 0.25);
  });
});

describe('calculateOverallScore', () => {
  const maxed = (key, ...impls) => ({ key, level: 5, sources: src(...impls) });

  test('all signals maxed and bullish scores 100', () => {
    const signals = SIGNAL_KEYS.map((k) => maxed(k, 'up'));
    assert.equal(calculateOverallScore(signals, 'pokemon'), 100);
  });

  test('the same levels on bearish evidence score as falling — the Umbreon case', () => {
    const bullish = SIGNAL_KEYS.map((k) => maxed(k, 'up'));
    const bearish = SIGNAL_KEYS.map((k) => maxed(k, 'down'));
    const hot = calculateOverallScore(bullish, 'pokemon');
    const angry = calculateOverallScore(bearish, 'pokemon');
    assert.equal(hot, 100);
    assert.equal(angry, 0);
  });

  test('one bearish signal moves only its own configured weight', () => {
    const withOneBearish = SIGNAL_KEYS.map((k) => maxed(k, k === 'community' ? 'down' : 'up'));
    const score = calculateOverallScore(withOneBearish, 'pokemon');
    assert.ok(score >= 89 && score <= 90, `expected about 90, got ${score}`);
  });

  test('missing signals stay neutral instead of making a partial scan perfect', () => {
    const only = [maxed('creator', 'up'), maxed('scarcity', 'up')];
    assert.equal(calculateOverallScore(only, 'pokemon'), 74);
    assert.equal(calculateOverallScore([maxed('creator', 'up')], 'pokemon'), 63);
    assert.equal(calculateOverallScore([], 'pokemon'), 50);
  });

  test('model levels are clamped to 0–5 and score never leaves 0–100', () => {
    assert.equal(calculateOverallScore(SIGNAL_KEYS.map((key) => ({ key, level: 10, sources: src('up') })), 'pokemon'), 100);
    assert.equal(calculateOverallScore(SIGNAL_KEYS.map((key) => ({ key, level: 10, sources: src('down') })), 'pokemon'), 0);
    assert.equal(calculateOverallScore(SIGNAL_KEYS.map((key) => ({ key, level: -5, sources: src('up') })), 'pokemon'), 50);
  });

  test('reports coverage separately from the score', () => {
    const details = calculateScoreDetails([maxed('creator', 'up')], 'pokemon');
    assert.deepEqual(details, { score: 63, coveragePct: 25, evidencePct: 25, signalCount: 1 });
    assert.equal(SIGNAL_COUNT, 8);
  });

  test('an unknown game scores zero rather than throwing', () => {
    assert.equal(calculateOverallScore([maxed('creator', 'up')], 'lorcana'), 0);
  });
});
