import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { detectCardBoundsFromGray } from './uploadedCardCrop.js';

describe('uploaded card crop', () => {
  test('finds a portrait card and ignores keyboard-like rows above it', () => {
    const width = 120;
    const height = 240;
    const gray = new Uint8Array(width * height).fill(24);
    const set = (x, y, value) => { gray[y * width + x] = value; };

    // Keyboard-like horizontal bars above the card.
    for (const y of [12, 28, 44]) {
      for (let x = 0; x < width; x++) set(x, y, x % 20 < 16 ? 155 : 35);
    }

    // A 92×130 card at x=9, y=62 with detail inside its hard outer edge.
    for (let y = 62; y < 192; y++) {
      for (let x = 9; x < 101; x++) {
        const edge = x < 12 || x > 97 || y < 65 || y > 188;
        set(x, y, edge ? 235 : 70 + ((x + y) % 45));
      }
    }

    const result = detectCardBoundsFromGray(gray, width, height);
    assert.ok(Math.abs(result.x - 9) <= 7, `left edge ${result.x}`);
    assert.ok(Math.abs(result.y - 62) <= 7, `top edge ${result.y}`);
    assert.ok(Math.abs((result.x + result.width) - 101) <= 8, `right edge ${result.x + result.width}`);
    assert.ok(Math.abs((result.y + result.height) - 192) <= 8, `bottom edge ${result.y + result.height}`);
  });
});
