import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingScanCard, pendingPrintingId } from './pendingScan.js';

describe('pending scan identity', () => {
  test('keeps the exact full-art printing while the report runs', () => {
    const pin = {
      id: 'full-art-id',
      printingId: 'full-art-id',
      game: 'mtg',
      setName: 'Marvel Super Heroes',
      number: '321',
      imageLarge: 'captain-america-full-art.jpg',
    };
    const pending = pendingScanCard('Captain America', 'mtg', pin);
    assert.equal(pending.pin, pin);
    assert.equal(pendingPrintingId(pending), 'full-art-id');
    assert.equal(pending.pin.imageLarge, 'captain-america-full-art.jpg');
  });

  test('keeps camera and upload pins too', () => {
    const pending = pendingScanCard('Reinforcement of the Army', null, {
      game: 'yugioh',
      printingId: '32807846:L26D-ENS08',
      scanImagePath: 'signal-scan-art/32807846-l26d-ens08.jpg',
    });
    assert.equal(pending.game, 'yugioh');
    assert.equal(pending.pin.scanImagePath, 'signal-scan-art/32807846-l26d-ens08.jpg');
  });
});
