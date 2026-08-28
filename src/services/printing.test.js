// Tests for the identifier under the card name.
//
// The rule: show what is stamped on the card. Pokémon prints "161/131", not
// "161". Magic quotes a set code with the collector number. Yu-Gi-Oh's code
// already contains its set. A line that gets this wrong sends the reader back
// to the card to check, which is the whole thing it was added to prevent.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { printingLabel, resultCardPin, toPrinting } from './printing.js';

describe('printingLabel', () => {
  test('pokemon shows the number over the set total', () => {
    assert.equal(
      printingLabel({ game: 'pokemon', setName: 'Prismatic Evolutions', number: '161', printedTotal: '131', rarity: 'Special Illustration Rare' }),
      'Prismatic Evolutions · 161/131 · Special Illustration Rare',
    );
  });

  test('pokemon without a set total still shows the number', () => {
    assert.equal(
      printingLabel({ game: 'pokemon', setName: 'Base Set', number: '4' }),
      'Base Set · 4',
    );
  });

  test('mtg pairs the set code with the collector number', () => {
    assert.equal(
      printingLabel({ game: 'mtg', setName: 'Limited Edition Alpha', setId: 'lea', number: '233', rarity: 'rare' }),
      'Limited Edition Alpha · LEA 233 · rare',
    );
  });

  test('yugioh set code carries its own set, and is not repeated', () => {
    assert.equal(
      printingLabel({ game: 'yugioh', setName: 'LOB-EN005', number: 'LOB-EN005' }),
      'LOB-EN005',
    );
  });

  test('a set with no number still names the set', () => {
    assert.equal(printingLabel({ game: 'pokemon', setName: 'Evolutions' }), 'Evolutions');
  });

  test('nothing known means no line at all', () => {
    assert.equal(printingLabel(null), null);
    assert.equal(printingLabel({ game: 'pokemon' }), null);
  });
});

describe('toPrinting', () => {
  const cardData = { game: 'pokemon', catalogId: 'sv3-223', printingId: 'sv3-223', setName: 'Obsidian Flames', setId: 'sv3', number: '223', printedTotal: '197', rarity: 'Illustration Rare', imageUrl: 'https://images.example/sv3-223/large' };

  test('a chosen printing beats whatever the lookup returned', () => {
    const pin = { id: 'sv8pt5-161', setName: 'Prismatic Evolutions', setId: 'sv8pt5', number: '161' };
    const out = toPrinting('pokemon', pin, cardData);
    assert.equal(out.setName, 'Prismatic Evolutions');
    assert.equal(out.number, '161');
    assert.equal(out.rarity, null);
    assert.equal(out.printedTotal, null);
    assert.equal(out.pinned, true);
  });

  test('a matching exact lookup may enrich the pin with total and rarity', () => {
    const pin = { id: 'sv3-223', setName: 'Obsidian Flames', setId: 'sv3', number: '223' };
    const out = toPrinting('pokemon', pin, cardData);
    assert.equal(out.rarity, 'Illustration Rare');
    assert.equal(out.printedTotal, '197');
    assert.equal(out.printingId, 'sv3-223');
  });

  test('with no pin it uses the pre-fetch', () => {
    const out = toPrinting('pokemon', null, cardData);
    assert.equal(out.number, '223');
    assert.equal(out.printedTotal, '197');
    assert.equal(out.pinned, false);
    assert.equal(out.imageUrl, 'https://images.example/sv3-223/large');
  });

  test('knowing nothing produces nothing, not an empty shell', () => {
    assert.equal(toPrinting('pokemon', null, null), null);
    assert.equal(toPrinting('pokemon', null, { game: 'pokemon' }), null);
  });
});

describe('resultCardPin', () => {
  test('an old cached result keeps its exact printing for artwork lookup', () => {
    const printing = { game: 'pokemon', printingId: 'det1-10', setId: 'det1', number: '10' };
    assert.equal(resultCardPin({ printing }), printing);
  });

  test('a user-picked pin still wins over report metadata', () => {
    const pin = { id: 'sv8pt5-161' };
    assert.equal(resultCardPin({ _pin: pin, printing: { printingId: 'det1-10' } }), pin);
  });
});
