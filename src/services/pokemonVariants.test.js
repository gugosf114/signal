import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pokemonVariantRows, selectedPokemonVariant } from './pokemonVariants.js';
import { expandFinishRows, tcgdexPokemonRow, fetchPokemonVariantChoices, resolvePrintingOptions } from './fetchExpansions.js';
import { normalizeCardRecord, withCardRecord } from './cardRecord.js';
import { printingIdentity, toPrinting } from './printing.js';
import { scannerPrintingKey } from './scannerMatch.js';
import { addToCollection, loadCollection, collectionFormLabel } from './collection.js';
import { resolveCardProductImage } from './mtgCardImage.js';
import { sharedCardImageNote } from './mtgFinish.js';
import { fetchCardData } from './fetchCardData.js';
import { pricePatchFromCardData } from './refreshPrices.js';
import { addTcgplayerPrice } from './fetchTcgplayerPrice.js';
import { resolveProductId, pickHistorySku } from './priceHistory.js';
import { verifyPokemonProduct } from './pokemonProduct.js';

// Reduced snapshot of https://api.tcgdex.net/v2/en/cards/sv08.5-074.
const catalog = JSON.parse(readFileSync(new URL('./fixtures/pokemon-eevee-variants.json', import.meta.url)));
const products = JSON.parse(readFileSync(new URL('./fixtures/pokemon-products.json', import.meta.url)));
const verifyProduct = card => verifyPokemonProduct(card, { getProduct: async id => products[id] || null });
const rows = () => expandFinishRows(tcgdexPokemonRow(catalog));
const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
afterEach(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; });
const response = body => ({ ok: true, status: 200, json: async () => body });

test('Eevee exposes every physical variant with its own USD price', () => {
  const variants = rows();
  assert.deepEqual(variants.map(v => [v.finish, v.price, v.tcgplayerProductId]), [
    ['Normal', 0.26, 610429], ['Reverse Holo', 0.26, 610429],
    ['Poké Ball · Reverse Holo', 1.34, 610590],
    ['Master Ball · Reverse Holo', 14.73, 610691],
    ['Cosmos · Reverse Holo', null, null],
  ]);
  assert.equal(variants[3].pokemonPriceKey, 'holofoil');
  assert.equal(variants[4].priceSource, null);
  assert.equal(new Set(variants.map(printingIdentity)).size, 5);
  assert.equal(new Set(variants.map(scannerPrintingKey)).size, 5);
});

test('all five variants survive collection save/load and full Signal conversion', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  for (const row of rows()) {
    const card = normalizeCardRecord(row);
    const result = withCardRecord({ card_name: card.name, game: card.game,
      printing: toPrinting('pokemon', card), prices: { en_price: card.price === null ? '' : `$${card.price}` } }, card);
    assert.equal(result.card.pokemonVariantKey, card.pokemonVariantKey);
    assert.equal(result.card.finish, card.finish);
    addToCollection(result.card);
  }
  const saved = loadCollection();
  assert.equal(saved.length, 5);
  assert.deepEqual(saved.map(v => collectionFormLabel(v.game, v.form, v)).sort(), rows().map(v => v.finish).sort());
  const master = saved.find(v => v.finish.startsWith('Master Ball'));
  assert.equal(master.marketPrice, 14.73);
  assert.equal(saved.find(v => v.finish.startsWith('Cosmos')).marketPrice, null);
  assert.equal(addToCollection(rows()[3]).find(v => v.pokemonVariantKey === master.pokemonVariantKey).qty, 2);
});

test('ordinary Reverse retains its old collection key and clears a prior pattern label', () => {
  const reverse = rows()[1];
  assert.equal(printingIdentity(reverse), printingIdentity({ ...reverse, pokemonVariantKey: undefined }));
  const changed = normalizeCardRecord(reverse, rows()[3]);
  assert.equal(changed.pokemonVariantKey, null);
  assert.equal(changed.finish, 'Reverse Holo');
});

test('actual pattern photos use their exact product IDs; shared or missing photos stay labeled', async () => {
  const [normal, reverse, poke, master, cosmos] = await Promise.all(rows().map(card => resolveCardProductImage(card, { checkImage: async () => true, verifyProduct })));
  assert.match(poke.imageLarge, /610590\.jpg$/);
  assert.match(master.imageLarge, /610691\.jpg$/);
  assert.equal(master.price, products[610691].marketPrice);
  assert.equal(sharedCardImageNote(master), null);
  assert.ok(sharedCardImageNote(normal));
  assert.ok(sharedCardImageNote(reverse));
  assert.ok(sharedCardImageNote(cosmos));
  const failed = await resolveCardProductImage(rows()[3], { checkImage: async () => false, verifyProduct });
  assert.equal(failed.imageLarge, rows()[3].imageLarge);
  assert.ok(sharedCardImageNote(failed));
});

test('refresh reads the selected pattern price, including a pattern sold as Holofoil', async () => {
  globalThis.fetch = async url => {
    const productId = String(url).match(/\/product\/(\d+)\/details$/)?.[1];
    if (productId) return response(products[productId]);
    assert.match(String(url), /tcgdex\.net\/v2\/en\/cards\/sv08\.5-074$/);
    return response(catalog);
  };
  const master = rows()[3];
  const data = await fetchCardData('Eevee', 'pokemon', { ...master, price: 99 });
  assert.deepEqual(data.priceLines, [`Master Ball · Reverse Holo: $${products[610691].marketPrice.toFixed(2)} market`]);
  assert.equal(pricePatchFromCardData(data).en_price, `$${products[610691].marketPrice.toFixed(2)}`);
  assert.equal(data.pokemonVariantKey, master.pokemonVariantKey);
  const cosmos = await fetchCardData('Eevee', 'pokemon', rows()[4]);
  assert.equal(cosmos.priceLines, null);
  assert.equal(pricePatchFromCardData(cosmos).en_price, '');
  const skus = ['Reverse Holofoil', 'Holofoil'].map(variant => ({ variant, language: 'English', condition: 'Near Mint', buckets: [{ marketPrice: 14.73 }] }));
  assert.equal(pickHistorySku(skus, master).variant, 'Holofoil');
});

test('unpriced special versions never borrow a price or history through a name search', async () => {
  globalThis.fetch = async () => { assert.fail('No broad marketplace query is allowed'); };
  const cosmos = rows()[4];
  assert.equal((await addTcgplayerPrice(cosmos)).price, null);
  assert.equal(await resolveProductId(cosmos), null);
});

test('primary catalog matches load full TCGdex variants and do not cut the list at eight', async () => {
  const many = structuredClone(catalog);
  many.id = 'sv08.5-075'; many.localId = '075';
  for (let i = 0; i < 5; i++) many.variants_detailed.push({ type: 'reverse', foil: `test-pattern-${i}`, variantId: `test-${i}` });
  let detailsFetched = 0;
  globalThis.fetch = async url => {
    if (String(url).includes('api.tcgdex.net/v2/en/cards?')) return response([]);
    if (String(url).includes('api.pokemontcg.io/v2/cards')) return response({ data: [{ id: 'sv8pt5-75', name: 'Eevee', number: '75', set: { id: 'sv8pt5', name: 'Prismatic Evolutions' }, tcgplayer: { prices: { normal: { market: 0.26 } } } }] });
    assert.match(String(url), /tcgdex\.net\/v2\/en\/cards\/sv08\.5-075$/);
    detailsFetched++;
    return response(many);
  };
  const options = await resolvePrintingOptions({ name: 'Eevee', game: 'pokemon', number: '75', set: 'Prismatic Evolutions' });
  assert.equal(options.length, 10);
  assert.equal(new Set(options.map(printingIdentity)).size, 10);
  assert.equal(detailsFetched, 1);
  assert.equal((await fetchPokemonVariantChoices({ game: 'pokemon', id: 'sv8pt5-75' })).length, 10);
  assert.equal(detailsFetched, 1);
});

test('variant matching survives a changed provider ID and preserves edition/stamp distinctions', () => {
  const master = rows()[3];
  assert.equal(selectedPokemonVariant(catalog, { ...master, pokemonVariantId: 'changed' }).tcgplayerProductId, 610691);
  const variants = pokemonVariantRows({ variants_detailed: [
    { type: 'holo', stamp: ['1st-edition'] }, { type: 'holo', stamp: ['pokemon-center'] },
    { type: 'holo', subtype: 'unlimited' }, { type: 'holo', languages: ['ja'] },
  ] });
  assert.deepEqual(variants.map(v => v.finish), ['1st Edition Holo', 'Holo · Pokemon Center', 'Unlimited Holo']);
  assert.equal(new Set(variants.map(v => `${v.form}:${v.pokemonVariantKey}`)).size, 3);
});
