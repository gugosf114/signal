import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mtgRow, expandFinishRows } from './fetchExpansions.js';
import { mtgFinishLabel, sharedCardImageNote } from './mtgFinish.js';
import { resolveMtgCardImage } from './mtgCardImage.js';
import { normalizeCardRecord, withCardRecord } from './cardRecord.js';
import { printingLabel, toPrinting } from './printing.js';
import { addToCollection, loadCollection, collectionFormOptions } from './collection.js';
import { addTcgplayerPrice } from './fetchTcgplayerPrice.js';

let store;
beforeEach(() => {
  store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) };
});

function catalogue(overrides = {}) {
  return {
    id: 'edff761b-2c2a-414f-b0a3-25c3fdbcb0bc', name: 'The Lonely Mountain',
    set: 'hob', set_name: 'The Hobbit', collector_number: '284', rarity: 'rare',
    finishes: ['foil'], promo_types: ['surgefoil', 'universesbeyond'],
    prices: { usd: null, usd_foil: '47.41' }, tcgplayer_id: 707062,
    image_uris: { small: 'https://cards.example/284-small.jpg', png: 'https://cards.example/284-full.png' },
    ...overrides,
  };
}

test('Surge Foil survives catalog matching, full-report conversion, and Collection save/load', () => {
  const [choice] = expandFinishRows(mtgRow(catalogue()));
  const record = normalizeCardRecord(choice);
  assert.equal(record.finish, 'Surge Foil');
  assert.match(printingLabel(record), /HOB 284.*Surge Foil/);
  assert.equal(toPrinting('mtg', record, null).finish, 'Surge Foil');
  const report = withCardRecord({ card_name: record.name, game: 'mtg' }, record);
  assert.equal(report.card.finish, 'Surge Foil');
  assert.deepEqual(collectionFormOptions('mtg', record), [{ value: 'foil', label: 'Surge Foil' }]);
  addToCollection(record);
  const saved = loadCollection()[0];
  assert.equal(saved.form, 'foil');
  assert.equal(saved.finish, 'Surge Foil');
  assert.deepEqual(saved.promoTypes, ['surgefoil', 'universesbeyond']);
  assert.equal(saved.price, 47.41);
});

test('regular and foil entries retain separate prices while stating that their source photo is shared', async () => {
  const choices = expandFinishRows(mtgRow(catalogue({
    collector_number: '207', finishes: ['nonfoil', 'foil'], promo_types: ['universesbeyond'],
    prices: { usd: '5.69', usd_foil: '10.14' }, tcgplayer_id: 707061,
  })));
  const rows = await Promise.all(choices.map(card => resolveMtgCardImage(card, { checkImage: async () => true })));
  assert.deepEqual(rows.map(card => card.finish), ['Non-foil', 'Foil']);
  assert.deepEqual(rows.map(card => card.price), [5.69, 10.14]);
  assert.equal(rows[0].imageLarge, rows[1].imageLarge);
  assert.match(sharedCardImageNote(rows[1]), /Non-foil and Foil/);
  assert.equal(rows[1].priceSource, 'Scryfall');
});

test('TCGplayer image requests use the exact supplied product, without changing the card or price', async () => {
  const [card] = expandFinishRows(mtgRow(catalogue()));
  const checked = [];
  const result = await resolveMtgCardImage(card, { checkImage: async url => { checked.push(url); return true; } });
  assert.deepEqual(checked, ['https://product-images.tcgplayer.com/707062.jpg']);
  assert.equal(result.printingId, card.printingId);
  assert.equal(result.number, '284');
  assert.equal(result.price, card.price);
  assert.equal(result.finish, 'Surge Foil');
  assert.equal(sharedCardImageNote(result), null);
  assert.equal(result.imageSource, 'tcgplayer');
});

test('etched finish gets its own supplied product ID and picture', async () => {
  const choices = expandFinishRows(mtgRow(catalogue({ finishes: ['nonfoil', 'foil', 'etched'], promo_types: [],
    prices: { usd: '1', usd_foil: '2', usd_etched: '3' }, tcgplayer_id: 100, tcgplayer_etched_id: 200,
  })));
  const etched = choices.find(card => card.form === 'etched');
  assert.equal(etched.tcgplayerProductId, 200);
  const result = await resolveMtgCardImage(etched, { checkImage: async url => url.endsWith('/200.jpg') });
  assert.match(result.imageLarge, /\/200.jpg$/);
  assert.equal(result.price, 3);
  assert.equal(sharedCardImageNote(result), null);
  const normal = await resolveMtgCardImage(choices[0], { checkImage: async () => true });
  addToCollection(normal, { form: 'etched' });
  const saved = loadCollection()[0];
  assert.equal(saved.tcgplayerProductId, 200);
  assert.match(saved.imageLarge, /\/200.jpg$/);
});

test('missing or failed TCGplayer art keeps the original catalog image', async () => {
  const [card] = expandFinishRows(mtgRow(catalogue()));
  assert.equal(await resolveMtgCardImage(card, { checkImage: async () => false }), card);
  const unknown = { ...card, tcgplayerProductId: null, tcgplayerProductIds: null };
  assert.equal(await resolveMtgCardImage(unknown, { checkImage: () => { throw Error('must not search by name'); } }), unknown);
});

test('a shared product price cannot fill a missing price for the foil SKU', async () => {
  const choices = expandFinishRows(mtgRow(catalogue({ finishes: ['nonfoil', 'foil'],
    promo_types: [], prices: { usd: '5.69', usd_foil: null },
  })));
  const foil = choices.find(card => card.form === 'foil');
  assert.equal(await addTcgplayerPrice(foil), foil);
  assert.equal(foil.price, null);
});

test('special foil tags do not turn a non-foil finish into a foil or mistake unrelated tags for finishes', () => {
  assert.equal(mtgFinishLabel({ promoTypes: ['surgefoil'] }, 'normal'), 'Non-foil');
  assert.equal(mtgFinishLabel({ promoTypes: ['universesbeyond', 'poster'] }, 'foil'), 'Foil');
  assert.equal(mtgFinishLabel({ promo_types: ['textured'] }, 'foil'), 'Textured Foil');
  assert.equal(mtgFinishLabel({ promoTypes: ['galaxyfoil'] }, 'foil'), 'Galaxy Foil');
});
