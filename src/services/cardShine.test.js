import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardShinePreview } from './cardShine.js';
import { mtgRow, tcgdexPokemonRow, expandFinishRows } from './fetchExpansions.js';
import { resolveCardProductImage } from './mtgCardImage.js';
import { normalizeCardRecord } from './cardRecord.js';
import { scannerMatchDetails } from './scannerMatch.js';

test('shared MTG picture shines only on the foil choice and keeps its own price', async () => {
  const rows = expandFinishRows(mtgRow({ id: 'shine-mountain', name: 'The Lonely Mountain',
    set: 'hob', set_name: 'The Hobbit', collector_number: '207', finishes: ['nonfoil', 'foil'],
    tcgplayer_id: 707061, prices: { usd: '17.00', usd_foil: '26.00' },
    image_uris: { small: 'https://example.com/small.jpg', png: 'https://example.com/full.png' } }));
  const choices = await Promise.all(rows.map(row => resolveCardProductImage(row, { checkImage: async () => true })));
  assert.deepEqual(choices.map(cardShinePreview), [null, 'foil']);
  assert.deepEqual(choices.map(row => scannerMatchDetails({ pin: row }).price), [17, 26]);
  assert.match(scannerMatchDetails({ pin: choices[1] }).imageNote, /Shine preview/);
  assert.equal(choices[0].imageLarge, choices[1].imageLarge);
});

test('real Pokemon pattern photos stay untouched; shared Reverse and Cosmos get a preview', async () => {
  const catalog = JSON.parse(readFileSync(new URL('./fixtures/pokemon-eevee-variants.json', import.meta.url)));
  const cards = await Promise.all(expandFinishRows(tcgdexPokemonRow(catalog))
    .map(row => resolveCardProductImage(row, { checkImage: async () => true })));
  const before = JSON.stringify(cards);
  assert.deepEqual(cards.map(cardShinePreview), [null, 'foil', null, null, 'foil']);
  assert.deepEqual(cards.map(row => cardShinePreview(normalizeCardRecord(row))), [null, 'foil', null, null, 'foil']);
  assert.equal(cards[4].price, null);
  assert.equal(JSON.stringify(cards), before, 'preview never changes identity, price, or photo');
});

test('foil-only generic MTG art gets a preview until its dedicated photo loads', async () => {
  const card = { game: 'mtg', name: 'The Lonely Mountain', form: 'foil', finish: 'Surge Foil',
    availableFinishes: ['foil'], tcgplayerProductId: 707062, imageSource: 'scryfall', imageSharedFinishes: [] };
  assert.equal(cardShinePreview(card), 'foil');
  assert.equal(cardShinePreview(await resolveCardProductImage(card, { checkImage: async () => false })), 'foil');
  assert.equal(cardShinePreview(await resolveCardProductImage(card, { checkImage: async () => true })), null);
});

test('etched gets a silver preview; nonfoils, owner photos, and YGO art get no overlay', () => {
  assert.equal(cardShinePreview({ game: 'mtg', form: 'etched' }), 'etched');
  for (const card of [null, { game: 'mtg', form: 'normal', finish: 'Non-foil' },
    { game: 'pokemon', form: 'normal', pokemonImageShared: true },
    { game: 'pokemon', form: 'first_edition_normal', pokemonImageShared: true },
    { game: 'pokemon', form: 'holo', pokemonImageShared: true, imageSource: 'owner-scan' },
    { game: 'yugioh', rarity: 'Secret Rare', imageSource: 'tcgplayer' }]) {
    assert.equal(cardShinePreview(card), null);
  }
});
