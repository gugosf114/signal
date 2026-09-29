import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expandFinishRows, mtgRow, resolvePrintingOptions } from './fetchExpansions.js';
import { addTcgplayerPrice } from './fetchTcgplayerPrice.js';
import { normalizeCardRecord } from './cardRecord.js';
import { scannedPrintingTarget } from './printedIdentity.js';
import { fetchCardData } from './fetchCardData.js';
import { pricePatchFromCardData } from './refreshPrices.js';
import { applyCollectionPricePatch } from './collection.js';
import { printingIdentity, toPrinting } from './printing.js';
import { pickHistorySku } from './priceHistory.js';
import { fillMtgPrice, mtgProductIdentity } from './mtgProduct.js';
import { mtgNamedFoils } from './mtgFinish.js';
import { resolveCardProductImage } from './mtgCardImage.js';
import { cardShinePreview } from './cardShine.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/mtg-marvel-regressions.json', import.meta.url)));
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const response = data => ({ ok: true, status: 200, json: async () => data });

function mockProducts() {
  globalThis.fetch = async (url, init = {}) => {
    const target = new URL(url);
    if (target.hostname === 'api.scryfall.com') {
      const card = Object.values(fixture.cards).find(card => target.pathname.endsWith(card.id));
      assert.ok(card, 'only the selected catalog ID may be fetched');
      return response({ object: 'card', ...card });
    }
    const id = target.pathname.match(/\/product\/(\d+)\/details$/)?.[1];
    if (id) return response(fixture.products[id] || {});
    if (target.pathname.endsWith('/search/request')) {
      const query = target.searchParams.get('q');
      const rows = /hulk/i.test(query) ? fixture.search.hulk : /widow/i.test(query) ? fixture.search.widow
        : /repulsor|palisade/i.test(query) ? fixture.search.shields : [fixture.products[696391]];
      return response({ results: [{ results: rows }] });
    }
    throw Error('Unexpected request: ' + target.pathname);
  };
}

test('Raise Repulsor Shields matches its printed name at MSC 278', async () => {
  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    const data = { data: [fixture.cards[278]] };
    return response(body.action === 'catalogueFetch' ? { catalogue: true, ok: true, status: 200, data } : data);
  };
  const rows = await resolvePrintingOptions({ name: 'Raise Repulsor Shields', game: 'mtg', set: 'MSC', number: '0278', rarity: 'Rare' });
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.name === 'Raise Repulsor Shields' && row.number === '278'));
  assert.ok(normalizeCardRecord(rows[0]).nameAliases.includes('Raise the Palisade'));
});

test('Captain America survives the main-set family guess and the second reader rarity badge', async () => {
  const queries = [];
  globalThis.fetch = async (url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    const query = new URL(body.url || url).searchParams.get('q'); queries.push(query);
    const data = { data: query.startsWith('set:"Marvel Super Heroes"') ? [] : [fixture.cards[5]] };
    return response(body.action === 'catalogueFetch' ? { catalogue: true, ok: true, status: 200, data } : data);
  };
  const first = await resolvePrintingOptions({ name: 'Captain America, Team Leader', game: 'mtg', set: 'Marvel Super Heroes', number: '0005', rarity: 'Mythic' });
  assert.equal(first.length, 2);
  assert.ok(first.every(row => row.number === '5' && row.setId === 'msc'));
  assert.ok(queries.every(q => q.includes('cn:5')));
  const second = await resolvePrintingOptions({ name: 'Captain America, Team Leader', game: 'mtg', set: 'MSC', number: 'M0005', rarity: 'Mythic Rare' });
  assert.equal(second.length, 2);
  assert.equal(scannedPrintingTarget({ game: 'mtg', number: 'M0005', rarity: 'Mythic Rare' }).number, '5');
});

test('searching an underlying name does not discard the renamed printing from its selected set', async () => {
  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    const data = { data: [fixture.cards[278], { ...fixture.cards[278], id: 'another-print', flavor_name: undefined,
      set: 'ltc', set_name: 'Tales of Middle-earth Commander', collector_number: '100' }] };
    return response(body.action === 'catalogueFetch' ? { catalogue: true, ok: true, status: 200, data } : data);
  };
  const rows = await resolvePrintingOptions({ name: 'Raise the Palisade', game: 'mtg', set: 'MSC' });
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.name === 'Raise Repulsor Shields' && row.number === '278'));
});

test('missing Surge Foil prices use the matching finish product, not the normal or extended-art product', async () => {
  mockProducts();
  for (const [number, productId, price] of [[37, 697901, 5.34], [77, 696952, 29.56], [278, 697957, 7.56]]) {
    const [normal, foil] = expandFinishRows(mtgRow(fixture.cards[number]));
    assert.equal(foil.price, null, 'the source catalog is missing this foil price');
    const fixed = await addTcgplayerPrice(foil);
    assert.equal(fixed.price, price);
    assert.equal(fixed.tcgplayerProductId, productId);
    assert.equal(fixed.tcgplayerProductIds.foil, productId);
    assert.equal(normalizeCardRecord(fixed).tcgplayerProductId, productId);
    assert.equal(fixed.number, String(number));
    const shown = await resolveCardProductImage(fixed, { checkImage: async () => true });
    assert.equal(cardShinePreview(shown), 'foil', 'recovering a foil price preserves its shine preview');
    assert.equal((await addTcgplayerPrice(normal)).price, normal.price);
  }
});

test('a mixed Normal/Foil product headline cannot become the missing foil price', async () => {
  mockProducts();
  const foil = expandFinishRows(mtgRow({ ...fixture.cards[5], prices: { usd: '3.42', usd_foil: null } })).find(row => row.form === 'foil');
  assert.equal((await addTcgplayerPrice(foil)).price, null);
});

test('recovered foil product, photo and price survive reports and saved-card refresh', async () => {
  mockProducts();
  const foil = expandFinishRows(mtgRow(fixture.cards[37])).find(row => row.form === 'foil');
  const data = await fetchCardData(foil.name, 'mtg', foil);
  assert.deepEqual(data.priceLines, ['Surge Foil: $5.34 market']);
  assert.equal(data.tcgplayerProductId, 697901);
  const updated = applyCollectionPricePatch({ ...foil, qty: 2, marketPrice: null }, pricePatchFromCardData(data));
  assert.equal(updated.marketPrice, 5.34);
  assert.equal(updated.qty, 2);
  assert.equal(updated.tcgplayerProductIds.foil, 697901);
  assert.match(updated.imageLarge, /697901\.jpg$/);
  assert.equal(printingIdentity(updated), printingIdentity(foil));
  assert.equal(toPrinting('mtg', foil, data).tcgplayerProductId, 697901);
  assert.equal(pickHistorySku([{ variant: 'Normal', language: 'English', condition: 'Near Mint', buckets: [{ marketPrice: 99 }] }], updated), null);
});

test('finish rules work for another named foil and reject normal and wrong-number products', async () => {
  const card = { game: 'mtg', id: 'generic-textured-card', name: 'Example Card', setId: 'tst', setName: 'Test Set',
    number: '20', form: 'foil', promoTypes: ['textured'], tcgplayerProductId: 101, price: null };
  const product = { productId: 102, productLineName: 'Magic: The Gathering', productName: 'Example Card (Textured Foil)',
    setCode: 'TST', setName: 'Test Set', customAttributes: { number: '020' }, marketPrice: 12,
    skus: [{ language: 'English', variant: 'Foil' }] };
  const wrong = { ...product, productId: 101, productName: 'Example Card', marketPrice: 999, skus: [{ language: 'English', variant: 'Normal' }] };
  const changedNumber = { ...product, productId: 103, customAttributes: { number: '120' } };
  const result = await fillMtgPrice(card, { getProduct: async id => id === 102 ? product : wrong,
    search: async () => [wrong, changedNumber, product] });
  assert.equal(result.tcgplayerProductId, 102);
  assert.equal(result.price, 12);
  assert.equal(mtgProductIdentity({ ...card, promoTypes: [], finish: 'Foil' }, { ...product, productName: 'Example Card (Textured)' }), false);
  assert.deepEqual(mtgNamedFoils('Double Rainbow Foil'), ['doublerainbowfoil']);
});
