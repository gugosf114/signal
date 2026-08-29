import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createScannerBatchEntry,
  scannerBatchFormOptions,
  scannerBatchSummary,
  scannerMatchDetails,
  scannerMatchDisplayPrice,
  scannerMatchMeta,
  scannerMatchPrice,
  scannerPrintingKey,
} from './scannerMatch.js';

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
    assert.equal(scannerMatchDisplayPrice(details, 2), 'Choose below');
    assert.equal(scannerMatchDisplayPrice(details, 0), 'Not matched');
  });
});

describe('scanner batch', () => {
  test('same card finishes remain different scanner choices', () => {
    const normal = { printingId: 'pkm-1', form: 'normal', rarity: 'Uncommon' };
    const reverse = { printingId: 'pkm-1', form: 'reverse', rarity: 'Uncommon' };
    assert.notEqual(scannerPrintingKey(normal), scannerPrintingKey(reverse));
  });

  test('one exact match becomes one near-mint queue entry', () => {
    const match = { pin: { name: 'Black Lotus', game: 'mtg', price: 1000 } };
    assert.deepEqual(createScannerBatchEntry(match, 'row-1'), {
      id: 'row-1', match, quantity: 1, condition: 'near_mint', form: 'normal',
    });
    assert.equal(createScannerBatchEntry({ card: { name: 'Unconfirmed' } }, 'row-2'), null);
  });

  test('batch totals count copies and keep missing prices visible', () => {
    const entries = [
      { quantity: 2, match: { pin: { price: 12.50 } } },
      { quantity: 1, match: { pin: { price: null } } },
    ];
    assert.deepEqual(scannerBatchSummary(entries), { cards: 3, value: 25, unpriced: 1 });
  });

  test('batch finish choices follow each game', () => {
    assert.deepEqual(scannerBatchFormOptions('pokemon').map((item) => item.label), ['Normal', 'Reverse Holo']);
    assert.deepEqual(scannerBatchFormOptions('mtg').map((item) => item.label), ['Non-foil', 'Foil']);
    assert.deepEqual(scannerBatchFormOptions('yugioh'), []);
  });
});
