import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { scannerMatchDetails, scannerMatchMeta, scannerMatchPrice } from './scannerMatch.js';

describe('scanner match display', () => {
  test('uses the live catalogue printing instead of the vision guess', () => {
    const details = scannerMatchDetails({
      card: { name: 'Reinforcement of the Army', game: 'yugioh', set: 'L26D', number: 'ENS08', confidence: 'high' },
      pin: {
        name: 'Reinforcement of the Army',
        game: 'yugioh',
        setName: 'Legendary Modern Decks 2026',
        number: 'L26D-ENS08',
        rarity: 'Starlight Rare',
        imageUrl: 'https://example.com/exact.jpg',
        price: 293.41,
      },
    });

    assert.equal(details.exact, true);
    assert.equal(details.number, 'L26D-ENS08');
    assert.equal(details.rarity, 'Starlight Rare');
    assert.equal(scannerMatchMeta(details), 'Legendary Modern Decks 2026 · L26D-ENS08 · Starlight Rare');
    assert.equal(scannerMatchPrice(details), '$293.41');
  });

  test('marks a vision-only result as needing a manual printing check', () => {
    const details = scannerMatchDetails({
      card: { name: 'Island', game: 'mtg', set: 'Unknown', confidence: 'medium' },
    });

    assert.equal(details.exact, false);
    assert.equal(details.name, 'Island');
    assert.equal(details.gameLabel, 'Magic');
    assert.equal(scannerMatchPrice(details), 'Price unavailable');
  });
});
