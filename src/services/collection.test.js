// Tests for the collection store.
//
// The rule this pins: a collection is a list of PRINTINGS, not names. Two
// Umbreon ex cards from the same set are two different cards, and scanning the
// same card twice is one card you own two of — not two rows.
//
// localStorage is stubbed before the module is imported.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const {
  loadCollection, addToCollection, removeOne, removeAll, countCards, cardKey,
} = await import('./collection.js');

const RICH = { id: 'sv8pt5-161', game: 'pokemon', name: 'Umbreon ex', setName: 'Prismatic Evolutions', number: '161' };
const CHEAP = { id: 'sv8pt5-60', game: 'pokemon', name: 'Umbreon ex', setName: 'Prismatic Evolutions', number: '60' };

describe('collection', () => {
  beforeEach(() => { store = {}; });

  test('starts empty and survives junk in storage', () => {
    assert.deepEqual(loadCollection(), []);
    store['signal_collection_v1'] = 'not json';
    assert.deepEqual(loadCollection(), []);
    store['signal_collection_v1'] = '{"not":"an array"}';
    assert.deepEqual(loadCollection(), []);
  });

  test('two printings of one name are two cards', () => {
    addToCollection(RICH);
    const list = addToCollection(CHEAP);
    assert.equal(list.length, 2);
    assert.equal(countCards(list), 2);
  });

  test('adding the same printing twice is one card, count two', () => {
    addToCollection(RICH);
    const list = addToCollection(RICH);
    assert.equal(list.length, 1);
    assert.equal(list[0].qty, 2);
    assert.equal(countCards(list), 2);
  });

  test('the card you just touched goes to the front', () => {
    addToCollection(RICH);
    addToCollection(CHEAP);
    const list = addToCollection(RICH);      // bumping a count, not a new row
    assert.equal(list[0].id, 'sv8pt5-161');
    assert.equal(list.length, 2);
  });

  test('removing one leaves the rest of the copies', () => {
    addToCollection(RICH);
    addToCollection(RICH);
    addToCollection(RICH);
    const list = removeOne(RICH);
    assert.equal(list[0].qty, 2);
    assert.equal(list.length, 1);
  });

  test('removing the last copy removes the row', () => {
    addToCollection(RICH);
    const list = removeOne(RICH);
    assert.deepEqual(list, []);
  });

  test('removeAll drops every copy at once', () => {
    addToCollection(RICH);
    addToCollection(RICH);
    addToCollection(CHEAP);
    const list = removeAll(RICH);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'sv8pt5-60');
  });

  test('removing something not held changes nothing', () => {
    addToCollection(RICH);
    const list = removeOne(CHEAP);
    assert.equal(list.length, 1);
    assert.equal(list[0].qty, 1);
  });

  test('a card with no catalogue id still gets a stable identity', () => {
    const noId = { game: 'yugioh', name: 'Dark Magician', setName: 'LOB', number: '005' };
    addToCollection(noId);
    const list = addToCollection({ ...noId });
    assert.equal(list.length, 1);
    assert.equal(list[0].qty, 2);
  });

  test('same name, different set, no ids: still two cards', () => {
    const a = { game: 'yugioh', name: 'Dark Magician', setName: 'LOB' };
    const b = { game: 'yugioh', name: 'Dark Magician', setName: 'SDY' };
    addToCollection(a);
    assert.equal(addToCollection(b).length, 2);
  });

  test('Yu-Gi-Oh reprints sharing one card id stay separate', () => {
    const common = { id: '89631139', printingId: '89631139:LDK2-ENJ01', game: 'yugioh', name: 'Blue-Eyes White Dragon' };
    const ultra = { id: '89631139', printingId: '89631139:LOB-EN001', game: 'yugioh', name: 'Blue-Eyes White Dragon' };
    addToCollection(common);
    const list = addToCollection(ultra);
    assert.equal(list.length, 2);
    assert.notEqual(cardKey(common), cardKey(ultra));
  });

  test('bad stored quantities are repaired before use', () => {
    store['signal_collection_v1'] = JSON.stringify([{ ...RICH, qty: 'not-a-number' }]);
    assert.equal(loadCollection()[0].qty, 1);
    store['signal_collection_v1'] = JSON.stringify([{ ...RICH, qty: -7 }]);
    assert.equal(loadCollection()[0].qty, 1);
    store['signal_collection_v1'] = JSON.stringify([{ ...RICH, qty: 100000 }]);
    assert.equal(loadCollection()[0].qty, 999);
  });

  test('a nameless card is refused', () => {
    addToCollection({ id: 'x', game: 'mtg' });
    assert.deepEqual(loadCollection(), []);
  });

  test('entries carry artwork and a timestamp', () => {
    const list = addToCollection({ ...RICH, imageUrl: 'small.png', imageLarge: 'big.png' }, '2026-08-15T00:00:00.000Z');
    assert.equal(list[0].imageLarge, 'big.png');
    assert.equal(list[0].addedAt, '2026-08-15T00:00:00.000Z');
  });

  test('cardKey never merges different games', () => {
    assert.notEqual(
      cardKey({ id: '1', game: 'pokemon', name: 'X' }),
      cardKey({ id: '1', game: 'mtg', name: 'X' }),
    );
  });
});
