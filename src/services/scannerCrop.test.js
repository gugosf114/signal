import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVideoCrop } from './scannerCrop.js';

describe('scanner frame crop', () => {
  test('maps a centered portrait frame through a cover-scaled landscape camera', () => {
    const crop = computeVideoCrop(1920, 1080, 390, 844, { x: 80, y: 120, width: 230, height: 321 });
    assert.ok(crop.x > 700 && crop.x < 900);
    assert.ok(crop.y > 150 && crop.y < 300);
    assert.ok(crop.width > 250);
    assert.ok(Math.abs(crop.width / crop.height - 230 / 321) < 0.01);
  });

  test('rejects an empty frame instead of capturing random pixels', () => {
    assert.equal(computeVideoCrop(1920, 1080, 390, 844, { x: 0, y: 0, width: 0, height: 0 }), null);
  });
});
