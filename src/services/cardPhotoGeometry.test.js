import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardShape, chooseCardBounds, orderCardCorners } from './cardPhotoGeometry.js';

const card = [{ x: 140, y: 160 }, { x: 460, y: 175 }, { x: 450, y: 620 }, { x: 130, y: 610 }];
const rectangle = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

test('finds a tilted card and keeps a margin outside all printed edges', () => {
  const result = chooseCardBounds([card], 600, 800);
  assert.ok(result);
  assert.ok(result.corners[0].x < card[0].x && result.corners[0].y < card[0].y);
  assert.ok(result.corners[2].x > card[2].x && result.corners[2].y > card[2].y);
});

test('chooses the outer card/sleeve rather than an inner printed panel', () => {
  const inner = rectangle(180, 220, 240, 336);
  const result = chooseCardBounds([inner, card, [...card].reverse()], 600, 800);
  assert.ok(result && result.area > 130000);
});

test('keeps the photo when the card is clipped, tiny, square, or too skewed', () => {
  for (const points of [rectangle(0, 50, 320, 448), rectangle(230, 290, 40, 56), rectangle(100, 100, 350, 350),
    [{ x: 100, y: 100 }, { x: 440, y: 120 }, { x: 290, y: 660 }, { x: 170, y: 660 }]]) {
    assert.equal(chooseCardBounds([points], 600, 800), null);
  }
});

test('keeps the photo when two separate card-sized rectangles compete', () => {
  assert.equal(chooseCardBounds([rectangle(40, 100, 280, 392), rectangle(380, 150, 280, 392)], 720, 700), null);
});

test('works with sideways cards and shuffled contour points', () => {
  const landscape = rectangle(50, 100, 448, 320);
  assert.ok(cardShape(landscape, 600, 700));
  assert.deepEqual(orderCardCorners([landscape[2], landscape[0], landscape[3], landscape[1]]), landscape);
});

test('rejects empty and malformed detector results', () => {
  assert.equal(chooseCardBounds([], 600, 800), null);
  assert.equal(cardShape([{ x: NaN, y: 1 }, ...card.slice(1)], 600, 800), null);
  assert.equal(cardShape(card, 0, 800), null);
});
