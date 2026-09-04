import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE_CASCADE_DURATION_MS,
  ambientParallax,
  ambientPointerOffset,
  ambientTiltOffset,
  claimPageCascade,
} from './ambientMotion.js';

test('ambient tilt centers a normally held phone', () => {
  assert.deepEqual(ambientTiltOffset(45, 0), { x: 0, y: 0 });
  assert.deepEqual(ambientTiltOffset(null, null), { x: 0, y: 0 });
  assert.deepEqual(ambientTiltOffset(87, 4, 87, 4), { x: 0, y: 0 });
});

test('ambient tilt clamps extreme sensor values', () => {
  assert.deepEqual(ambientTiltOffset(200, -200), { x: -28, y: 20 });
});

test('ambient tilt follows movement from the first phone position', () => {
  const offset = ambientTiltOffset(107, 20, 87, 4);
  assert.equal(offset.x, 14);
  assert.ok(Math.abs(offset.y - 80 / 7) < Number.EPSILON * 16);
});

test('ambient pointer maps the viewport edges to a small parallax range', () => {
  assert.deepEqual(ambientPointerOffset(0, 0, 1000, 500), { x: -18, y: -12 });
  assert.deepEqual(ambientPointerOffset(1000, 500, 1000, 500), { x: 18, y: 12 });
});

test('ambient lights move against each other instead of as one flat layer', () => {
  const layers = ambientParallax({ x: 10, y: -8 });
  assert.deepEqual(layers.red, { x: 14, y: -9.6 });
  assert.deepEqual(layers.gold, { x: -8.5, y: 6 });
  assert.ok(layers.red.x > 0 && layers.gold.x < 0);
});

test('each page cascade can be claimed only once per app session', () => {
  const visited = new Set(['signal']);
  assert.equal(claimPageCascade(visited, 'signal'), false);
  assert.equal(claimPageCascade(visited, 'collection'), true);
  assert.equal(claimPageCascade(visited, 'collection'), false);
  assert.equal(claimPageCascade(visited, 'dossier'), true);
  assert.equal(claimPageCascade(visited, 'unknown'), false);
  assert.ok(PAGE_CASCADE_DURATION_MS >= 2500);
});
