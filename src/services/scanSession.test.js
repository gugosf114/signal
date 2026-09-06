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
    const pin = { id: '32807846', printingId: '32807846:RA01-EN047', game: 'yugioh' };
    savePendingScanSession({
      name: 'Reinforcement of the Army', game: 'yugioh', pin,
      force: true, startedAt: 1000,
    }, storage);

    assert.deepEqual(loadRecoverableScanSession(storage, 2000), {
      status: 'pending',
      name: 'Reinforcement of the Army',
      game: 'yugioh',
      pin,
      force: true,
      startedAt: 1000,
    });
  });

  test('keeps a finished answer for the next app opening', () => {
    const pin = { game: 'mtg', printingId: 'lea-233', form: 'normal' };
    const result = { card_name: 'Black Lotus', game: 'mtg', _pin: pin };
    saveCompletedScanSession({ name: 'Black Lotus', game: 'mtg', pin, result, completedAt: 5000 }, storage);
    assert.deepEqual(loadRecoverableScanSession(storage, 6000)?.result, result);
    assert.deepEqual(loadRecoverableScanSession(storage, 7000)?.result, result);
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
