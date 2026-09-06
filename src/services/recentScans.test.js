import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPrintingPin,
  nameClaimsExactPrinting,
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
    assert.deepEqual(sanitizeRecentScans([unsafe, EXACT_ROTA]), [EXACT_ROTA]);
  });

  test('plain old unpinned card scans are hidden instead of launching broad', () => {
    const broad = { name: 'Black Lotus', game: 'mtg', score: 60, pin: null };
    assert.deepEqual(sanitizeRecentScans([broad]), []);
  });

  test('recognizes exact-print words before a broad scan begins', () => {
    assert.equal(nameClaimsExactPrinting('Charizard ex Special Illustration Rare'), true);
    assert.equal(nameClaimsExactPrinting('Charizard ex'), false);
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
