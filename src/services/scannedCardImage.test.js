import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { scannedCardImagePath } from './scannedCardImage.js';

describe('scanned card image path', () => {
  test('uses the exact printing id and no user text', () => {
    assert.equal(
      scannedCardImagePath({ printingId: '32807846:L26D-ENS08' }),
      'signal-scan-art/32807846-l26d-ens08.jpg',
    );
  });

  test('refuses a broad card with no stable id', () => {
    assert.equal(scannedCardImagePath({ name: 'Reinforcement of the Army' }), null);
  });
});
