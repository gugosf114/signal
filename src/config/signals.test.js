// Tests for the weighted score, and specifically for direction.
//
// The bug these pin: the score used to read `level` alone, so a signal could be
// maxed out on purely bearish evidence and still push the score up. Umbreon ex
// scored 77 — SURGING, "real upward pressure" — off community volume that was
// backlash over scalping. Its own summary said "strong bearish signals." The
// price fell. The score could not tell excitement from a riot.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOverallScore, sourceDirection, directionMultiplier } from './signals.js';

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
  test('bullish and neutral are unpenalised', () => {
    assert.equal(directionMultiplier(src('up', 'up')), 1);
    assert.equal(directionMultiplier(src('neutral')), 1);
    assert.equal(directionMultiplier([]), 1);
  });

  test('fully bearish is halved, not zeroed', () => {
    assert.equal(directionMultiplier(src('down', 'down')), 0.5);
  });

  test('partly bearish is damped proportionally', () => {
    // net = (1 - 3) / 4 = -0.5  →  1 + (-0.5 * 0.5) = 0.75
    assert.equal(directionMultiplier(src('up', 'down', 'down', 'down')), 0.75);
  });
});

describe('calculateOverallScore', () => {
  const maxed = (key, ...impls) => ({ key, level: 5, sources: src(...impls) });

  test('all signals maxed and bullish scores 100', () => {
    const signals = ['creator', 'community', 'ip_momentum', 'editorial',
                     'competitive', 'scarcity', 'jp_hype', 'jp_release']
      .map((k) => maxed(k, 'up'));
    assert.equal(calculateOverallScore(signals, 'pokemon'), 100);
  });

  test('the same levels on bearish evidence score lower — the Umbreon case', () => {
    const keys = ['creator', 'community', 'ip_momentum', 'editorial',
                  'competitive', 'scarcity', 'jp_hype', 'jp_release'];
    const bullish = keys.map((k) => maxed(k, 'up'));
    const bearish = keys.map((k) => maxed(k, 'down'));
    const hot = calculateOverallScore(bullish, 'pokemon');
    const angry = calculateOverallScore(bearish, 'pokemon');
    assert.equal(hot, 100);
    assert.equal(angry, 50);           // halved, not zeroed
    assert.ok(angry < hot, 'bearish evidence must not score like bullish evidence');
  });

  test('one bearish signal drags the total down by its own weight only', () => {
    const keys = ['creator', 'community', 'ip_momentum', 'editorial',
                  'competitive', 'scarcity', 'jp_hype', 'jp_release'];
    const withOneBearish = keys.map((k) => maxed(k, k === 'community' ? 'down' : 'up'));
    const score = calculateOverallScore(withOneBearish, 'pokemon');
    // community carries 0.09 of 0.87 total for pokemon; halving it costs ~5 points.
    assert.ok(score > 90 && score < 100, `expected a small drop, got ${score}`);
  });

  test('missing signals re-share their weight instead of scoring zero', () => {
    const only = [maxed('creator', 'up'), maxed('scarcity', 'up')];
    assert.equal(calculateOverallScore(only, 'pokemon'), 100);
  });

  test('an unknown game scores zero rather than throwing', () => {
    assert.equal(calculateOverallScore([maxed('creator', 'up')], 'lorcana'), 0);
  });
});
