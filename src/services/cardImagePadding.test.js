import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCardImagePadding } from './cardImagePadding.js';

function fixture({ padding = 4, alpha = 255, noise = false } = {}) {
  const width = 500, height = 700;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const outer = x < padding || x >= width - padding || y < padding || y >= height - padding;
    const i = (y * width + x) * 4;
    const color = outer ? noise && (x * 13 + y * 7) % 97 === 0 ? 243 : 255 : 180;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = color;
    pixels[i + 3] = outer ? alpha : 255;
  }
  return { pixels, width, height };
}

test('trims thin outer padding without touching the printed border', () => {
  const { pixels, width, height } = fixture();
  const result = detectCardImagePadding(pixels, width, height);
  assert.equal(result.left * width, 4);
  assert.equal(result.right * width, 4);
  assert.equal(result.top * height, 4);
  assert.equal(result.bottom * height, 4);
  assert.equal(result.ratio, (width - 8) / (height - 8));
});
test('small JPEG noise does not turn uniform padding into an unrecognised edge', () => {
  const { pixels, width, height } = fixture({ noise: true });
  assert.equal(detectCardImagePadding(pixels, width, height).left * width, 4);
});
test('wide printed white borders are preserved', () => {
  const { pixels, width, height } = fixture({ padding: 25 });
  assert.equal(detectCardImagePadding(pixels, width, height), null);
});
test('transparent backgrounds and images without a white margin are preserved', () => {
  for (const options of [{ alpha: 0 }, { padding: 0 }]) {
    const { pixels, width, height } = fixture(options);
    assert.equal(detectCardImagePadding(pixels, width, height), null);
  }
});
