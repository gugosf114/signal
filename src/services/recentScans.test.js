import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPrintingPin,
  recentPrintingLine,
  sanitizeRecentScans,
} from './recentScans.js';

const EXACT_ROTA = {
  name: 'Reinforcement of the Army',
  game: 'yugioh',
  score: 72,
  pin: {
    id: '32807846',
    printingId: '32807846:L26D-ENS08',
    game: 'yugioh',
    setName: 'Legendary Modern Decks 2026',
    number: 'L26D-ENS08',
    rarity: 'Starlight Rare',
  },
};

describe('recent scan printing safety', () => {
  test('an exact pin keeps the stable card ID visible', () => {
    assert.equal(
      recentPrintingLine(EXACT_ROTA),
      'Legendary Modern Decks 2026 · L26D-ENS08 · Starlight Rare',
    );
  });

  test('drops a label that claims a Starlight printing but lost its pin', () => {
    const unsafe = {
      name: 'Reinforcement of the Army (Alternate Art) (Starlight Rare)',
      game: 'yugioh',
      score: 45,
      pin: null,
    };
    const clean = sanitizeRecentScans([unsafe, EXACT_ROTA]);
    assert.equal(clean.length, 1);
    assert.equal(clean[0].name, EXACT_ROTA.name);
    assert.equal(clean[0].pin.printingId, EXACT_ROTA.pin.printingId);
    assert.equal(clean[0].pin.recordVersion, 1);
  });

  test('plain old unpinned card scans are hidden instead of launching broad', () => {
    const broad = { name: 'Black Lotus', game: 'mtg', score: 60, pin: null };
    assert.deepEqual(sanitizeRecentScans([broad]), []);
  });

  test('a Yu-Gi-Oh card id without a set printing is still broad', () => {
    assert.equal(hasPrintingPin({ game: 'yugioh', id: '32807846' }), false);
    assert.equal(hasPrintingPin(EXACT_ROTA.pin), true);
  });

  test('the same exact-print gate covers all three games', () => {
    assert.equal(hasPrintingPin({ game: 'pokemon', id: 'ex3-97', printingId: 'ex3-97', form: 'holo' }), true);
    assert.equal(hasPrintingPin({ game: 'mtg', id: 'f04ed2cc', printingId: 'f04ed2cc', form: 'normal' }), true);
    assert.equal(hasPrintingPin({ game: 'pokemon' }), false);
    assert.equal(hasPrintingPin({ game: 'mtg' }), false);
    assert.equal(hasPrintingPin({ game: 'yugioh', id: '89631139' }), false);
  });

  test('rejects a broad lookup that merely returned one printing', () => {
    assert.equal(hasPrintingPin({ game: 'pokemon', printingId: 'ex15-97', form: 'holo', pinned: false }), false);
    assert.equal(hasPrintingPin({ game: 'mtg', printingId: 'one-card-but-no-finish' }), false);
  });
});
