// Tests for the collection store.
//
// The rule this pins: catalogue identity keeps different cards apart. The
// user's condition and form keep different holdings apart.
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
  loadCollection, addToCollection, importCollection, removeOne, removeAll,
  countCards, collectionValue, collectionValueSummary, cardKey, marketPriceFor,
  formatCollectionMoney, collectionFormLabel, collectionFormOptions, collectionView,
} = await import('./collection.js');

const RICH = {
  id: 'sv8pt5-161', game: 'pokemon', name: 'Umbreon ex',
  setName: 'Prismatic Evolutions', number: '161',
  marketPrices: { normal: 100, reverse: 140 }, price: 100,
};
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

  test('one add can carry quantity, condition, form, and paid amount', () => {
    const list = addToCollection(RICH, {
      quantity: 3,
      condition: 'lightly_played',
      form: 'reverse',
      paidPerCard: '75.50',
    });
    assert.equal(list[0].qty, 3);
    assert.equal(list[0].condition, 'lightly_played');
    assert.equal(list[0].form, 'reverse');
    assert.equal(list[0].marketPrice, 140);
    assert.equal(list[0].paidPerCard, 75.5);
  });

  test('different conditions and forms stay as separate holdings', () => {
    addToCollection(RICH, { condition: 'near_mint', form: 'normal' });
    addToCollection(RICH, { condition: 'damaged', form: 'normal' });
    const list = addToCollection(RICH, { condition: 'near_mint', form: 'reverse' });
    assert.equal(list.length, 3);
  });

  test('paid amounts merge as a per-card average', () => {
    addToCollection(RICH, { quantity: 2, paidPerCard: 50 });
    const list = addToCollection(RICH, { quantity: 1, paidPerCard: 80 });
    assert.equal(list[0].qty, 3);
    assert.equal(list[0].paidPerCard, 60);
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

  test('entries keep catalogue artwork and reject an uploaded phone photo', () => {
    const list = addToCollection({
      ...RICH,
      imageUrl: 'http://localhost/_capacitor_file_/data/user/0/signal-scan-art/card.jpg',
      imageLarge: 'https://catalog.example/cards/big.png',
      scanImagePath: 'signal-scan-art/sv8pt5-161.jpg',
    }, '2026-08-15T00:00:00.000Z');
    assert.equal(list[0].imageUrl, 'https://catalog.example/cards/big.png');
    assert.equal(list[0].imageLarge, 'https://catalog.example/cards/big.png');
    assert.equal(list[0].scanImagePath, null);
    assert.equal(list[0].addedAt, '2026-08-15T00:00:00.000Z');
  });

  test('old collection rows containing only an uploaded photo show no art', () => {
    store['signal_collection_v1'] = JSON.stringify([{
      ...RICH,
      imageUrl: 'blob:https://localhost/uploaded-card',
      imageLarge: 'file:///data/user/0/signal-scan-art/card.jpg',
      scanImagePath: 'signal-scan-art/card.jpg',
      imageSource: 'owner-crop',
    }]);
    const [card] = loadCollection();
    assert.equal(card.imageUrl, null);
    assert.equal(card.imageLarge, null);
    assert.equal(card.scanImagePath, null);
  });

  test('an exact TCGplayer product image is kept', () => {
    const image = 'https://product-images.tcgplayer.com/683013.jpg';
    const [card] = addToCollection({
      ...RICH,
      imageUrl: image,
      imageLarge: image,
      imageSource: 'tcgplayer',
      tcgplayerProductId: 683013,
      tcgplayerImageUrl: image,
    });
    assert.equal(card.imageUrl, image);
    assert.equal(card.scanImagePath, null);
    assert.equal(card.imageSource, 'tcgplayer');
    assert.equal(card.tcgplayerProductId, 683013);
  });

  test('cardKey never merges different games', () => {
    assert.notEqual(
      cardKey({ id: '1', game: 'pokemon', name: 'X' }),
      cardKey({ id: '1', game: 'mtg', name: 'X' }),
    );
  });

  test('market total uses quantity and the selected form', () => {
    const normal = addToCollection(RICH, { quantity: 2, form: 'normal' });
    assert.equal(collectionValue(normal), 200);
    assert.equal(marketPriceFor(RICH, 'reverse'), 140);
  });

  test('missing prices stay missing instead of becoming zero', () => {
    assert.equal(formatCollectionMoney(null), '—');
    assert.equal(formatCollectionMoney(''), '—');
    assert.equal(formatCollectionMoney(0), '$0.00');
    const list = [
      { ...RICH, qty: 1, marketPrice: 100 },
      { ...CHEAP, qty: 2, marketPrice: null },
    ];
    assert.deepEqual(collectionValueSummary(list), {
      total: 100,
      pricedQty: 1,
      unpricedQty: 2,
    });
  });

  test('form labels follow the game instead of calling every finish reverse', () => {
    assert.equal(collectionFormLabel('pokemon', 'reverse'), 'Reverse Holo');
    assert.equal(collectionFormLabel('pokemon', 'holo'), 'Holo');
    assert.equal(collectionFormLabel('mtg', 'normal'), 'Non-foil');
    assert.equal(collectionFormLabel('mtg', 'foil'), 'Foil');
    assert.equal(collectionFormLabel('mtg', 'etched'), 'Etched');
    assert.equal(collectionFormLabel('yugioh', 'normal'), '');
    assert.deepEqual(collectionFormOptions('mtg').map((option) => option.label), ['Non-foil', 'Foil']);
    assert.deepEqual(collectionFormOptions('yugioh'), []);
  });

  test('each Pokémon and Magic finish keeps its own collection price', () => {
    const pokemon = {
      ...RICH, form: 'holo', finish: 'Holo',
      availableFinishes: ['normal', 'holo', 'reverse'],
      marketPrices: { normal: 2.25, holo: 7.5, reverse: 4.75 }, price: 7.5,
    };
    assert.deepEqual(collectionFormOptions('pokemon', pokemon).map((option) => option.label),
      ['Normal', 'Holo', 'Reverse Holo']);
    assert.equal(marketPriceFor(pokemon, 'holo'), 7.5);
    assert.equal(marketPriceFor(pokemon, 'reverse'), 4.75);

    const mtg = {
      id: 'mtg-etched', game: 'mtg', name: 'Test Mage', form: 'etched',
      availableFinishes: ['normal', 'foil', 'etched'],
      marketPrices: { normal: 3, foil: 8.5, etched: 11.25 }, price: 11.25,
    };
    assert.deepEqual(collectionFormOptions('mtg', mtg).map((option) => option.label),
      ['Non-foil', 'Foil', 'Etched']);
    assert.equal(marketPriceFor(mtg, 'etched'), 11.25);
  });

  test('Yu-Gi-Oh exact printings ignore a synthetic reverse form', () => {
    const rota = {
      id: '32807846', printingId: '32807846:L26D-ENS08', game: 'yugioh',
      name: 'Reinforcement of the Army', rarity: 'Starlight Rare',
    };
    addToCollection(rota, { form: 'normal' });
    const list = addToCollection(rota, { form: 'reverse' });
    assert.equal(list.length, 1);
    assert.equal(list[0].qty, 2);
    assert.equal(list[0].form, 'normal');
  });

  test('a backup import merges instead of deleting existing cards', () => {
    addToCollection(RICH);
    const list = importCollection([{ ...CHEAP, qty: 2, condition: 'damaged' }]);
    assert.equal(list.length, 2);
    assert.equal(countCards(list), 3);
  });

  test('binders split the three games while All keeps them combined', () => {
    const mixed = [
      { ...RICH, addedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'mtg-1', game: 'mtg', name: 'Black Lotus', marketPrice: 1000, addedAt: '2026-08-03T00:00:00.000Z' },
      { id: 'ygo-1', game: 'yugioh', name: 'Dark Magician', marketPrice: 50, addedAt: '2026-08-02T00:00:00.000Z' },
    ];
    assert.deepEqual(collectionView(mixed, 'all').map((card) => card.name), ['Black Lotus', 'Dark Magician', 'Umbreon ex']);
    assert.deepEqual(collectionView(mixed, 'pokemon').map((card) => card.name), ['Umbreon ex']);
    assert.deepEqual(collectionView(mixed, 'mtg').map((card) => card.name), ['Black Lotus']);
    assert.deepEqual(collectionView(mixed, 'yugioh').map((card) => card.name), ['Dark Magician']);
  });

  test('collection views sort by date and price without moving unpriced cards to the top', () => {
    const mixed = [
      { id: 'p', game: 'pokemon', name: 'Priced high', marketPrice: 100, addedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'm', game: 'mtg', name: 'Priced low', marketPrice: 10, addedAt: '2026-08-03T00:00:00.000Z' },
      { id: 'y', game: 'yugioh', name: 'Unpriced', marketPrice: null, addedAt: '2026-08-02T00:00:00.000Z' },
    ];
    assert.deepEqual(collectionView(mixed, 'all', 'newest').map((card) => card.name), ['Priced low', 'Unpriced', 'Priced high']);
    assert.deepEqual(collectionView(mixed, 'all', 'oldest').map((card) => card.name), ['Priced high', 'Unpriced', 'Priced low']);
    assert.deepEqual(collectionView(mixed, 'all', 'price_high').map((card) => card.name), ['Priced high', 'Priced low', 'Unpriced']);
    assert.deepEqual(collectionView(mixed, 'all', 'price_low').map((card) => card.name), ['Priced low', 'Priced high', 'Unpriced']);
    assert.equal(mixed[0].name, 'Priced high', 'the saved list was not mutated');
  });
});
