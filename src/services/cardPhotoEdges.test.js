import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCardBounds, straightenCard } from './cardPhotoEdges.js';

function picture(width, height, colorAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = colorAt(x, y), i = (y * width + x) * 4;
    data.set([...color, 255], i);
  }
  return { width, height, data };
}

test('detects the whole card from pixels, retaining its bottom number strip', () => {
  const image = picture(400, 600, (x, y) => {
    if (x < 90 || x > 310 || y < 145 || y > 453) return [25, 25, 25];
    if (y > 430) return [100, 140, 180];
    return [230, 225, 215];
  });
  const bounds = detectCardBounds(image);
  assert.ok(bounds);
  assert.ok(Math.min(...bounds.corners.map(p => p.y)) < 145);
  assert.ok(Math.max(...bounds.corners.map(p => p.y)) > 453);
  assert.ok(bounds.width > 220 && bounds.height > 308);
});

test('leaves black, low-contrast, and striped photos unchanged', () => {
  for (const colorAt of [() => [0, 0, 0], () => [124, 125, 124], (x, y) => (Math.floor(y / 16) % 2 ? [220, 220, 220] : [30, 30, 30])]) {
    assert.equal(detectCardBounds(picture(240, 320, colorAt)), null);
  }
});

test('background diagonals do not turn a straight card into a slanted crop', () => {
  const image = picture(400, 600, (x, y) => {
    if (x >= 85 && x <= 315 && y >= 140 && y <= 462) return y > 445 ? [110, 160, 190] : [225, 220, 205];
    return Math.abs(y - 0.22 * x - 110) < 3 || Math.abs(y - 0.2 * x - 435) < 3 ? [220, 220, 220] : [30, 30, 30];
  });
  const bounds = detectCardBounds(image);
  assert.ok(bounds);
  assert.ok(Math.abs(bounds.corners[0].y - bounds.corners[1].y) < 25);
  assert.ok(Math.abs(bounds.corners[2].y - bounds.corners[3].y) < 25);
  assert.ok(Math.min(bounds.corners[2].y, bounds.corners[3].y) > 462);
});

test('straightening keeps all four corner colors in their correct places', () => {
  const source = picture(80, 100, (x, y) => y < 50 ? (x < 40 ? [240, 10, 10] : [10, 240, 10])
    : (x < 40 ? [10, 10, 240] : [240, 240, 10]));
  const output = straightenCard(source, [{ x: 12, y: 12 }, { x: 65, y: 5 }, { x: 70, y: 90 }, { x: 5, y: 80 }], 50, 70);
  const pixel = (x, y) => [...output.slice((y * 50 + x) * 4, (y * 50 + x) * 4 + 3)];
  assert.deepEqual(pixel(0, 0), [240, 10, 10]);
  assert.deepEqual(pixel(49, 0), [10, 240, 10]);
  assert.deepEqual(pixel(49, 69), [240, 240, 10]);
  assert.deepEqual(pixel(0, 69), [10, 10, 240]);
});
