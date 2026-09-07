import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearScanSession,
  loadRecoverableScanSession,
  saveCompletedScanSession,
  savePendingScanSession,
  PENDING_MAX_AGE_MS,
} from './scanSession.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

let storage;

describe('scan session recovery', () => {
  beforeEach(() => { storage = memoryStorage(); });

  test('keeps the exact pending printing and original start time', () => {
    const pin = { id: '32807846', printingId: '32807846:RA01-EN047', game: 'yugioh', name: 'Reinforcement of the Army', setName: '25th Anniversary Rarity Collection', number: 'RA01-EN047' };
    savePendingScanSession({
      name: 'Reinforcement of the Army', game: 'yugioh', pin,
      force: true, startedAt: 1000,
    }, storage);

    const recovered = loadRecoverableScanSession(storage, 2000);
    assert.equal(recovered.status, 'pending');
    assert.equal(recovered.name, 'Reinforcement of the Army');
    assert.equal(recovered.pin.printingId, pin.printingId);
    assert.equal(recovered.pin.recordVersion, 1);
    assert.equal(recovered.startedAt, 1000);
  });

  test('keeps a finished answer for the next app opening', () => {
    const pin = { name: 'Black Lotus', game: 'mtg', printingId: 'lea-233', setName: 'Limited Edition Alpha', number: '233', form: 'normal' };
    const result = { card_name: 'Black Lotus', game: 'mtg', _pin: pin };
    saveCompletedScanSession({ name: 'Black Lotus', game: 'mtg', pin, result, completedAt: 5000 }, storage);
    const first = loadRecoverableScanSession(storage, 6000)?.result;
    const second = loadRecoverableScanSession(storage, 7000)?.result;
    assert.equal(first.card.printingId, 'lea-233');
    assert.equal(first.card, first._pin);
    assert.equal(first.card, first.printing);
    assert.equal(second.card.printingId, 'lea-233');
  });

  test('drops an old broad scan that silently chose one printing', () => {
    const printing = { game: 'pokemon', printingId: 'ex15-97', pinned: false };
    const result = { card_name: 'Rayquaza ex delta', game: 'pokemon', printing };
    saveCompletedScanSession({ name: 'Rayquaza ex', game: 'pokemon', result, completedAt: 5000 }, storage);
    assert.equal(loadRecoverableScanSession(storage, 6000), null);
  });

  test('drops a stale pending scan', () => {
    savePendingScanSession({ name: 'Old card', startedAt: 1000 }, storage);
    assert.equal(loadRecoverableScanSession(storage, 1000 + PENDING_MAX_AGE_MS + 1), null);
  });

  test('clear removes the checkpoint', () => {
    savePendingScanSession({ name: 'Black Lotus', startedAt: 1000 }, storage);
    clearScanSession(storage);
    assert.equal(loadRecoverableScanSession(storage, 2000), null);
  });
});
