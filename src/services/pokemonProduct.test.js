import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pokemonVariantRows } from './pokemonVariants.js';
import { verifyPokemonProduct, pokemonProductMatch } from './pokemonProduct.js';
import { addTcgplayerPrice } from './fetchTcgplayerPrice.js';
import { resolveCardProductImage } from './mtgCardImage.js';
import { fetchCardData } from './fetchCardData.js';
import { pricePatchFromCardData } from './refreshPrices.js';
import { normalizeCardRecord, cardPriceNeedsRefresh, withCardRecord } from './cardRecord.js';
import { addToCollection, loadCollection, applyCollectionPricePatch } from './collection.js';
import { printingIdentity, printingLabel, toPrinting } from './printing.js';
import { resolveProductId } from './priceHistory.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const promo = fixture('pokemon-eevee-svp173');
const prismatic = fixture('pokemon-eevee-variants');
const products = fixture('pokemon-products');
const getProduct = async id => products[id] || null;
const fixtureLookups = { getProduct, searchProducts: async () => [], getSkuMarket: async () => null };
const originalFetch = globalThis.fetch, originalStorage = globalThis.localStorage;
afterEach(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; });
const response = data => ({ ok: true, status: 200, json: async () => data });

function mockLiveSources() {
  globalThis.fetch = async (url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    const target = String(body.url || url);
    const id = target.match(/\/product\/(\d+)\/details$/)?.[1];
    if (id) return response(products[id]);
    assert.match(target, /api\.tcgdex\.net\/v2\/en\/cards\/svp-173$/);
    return response(body.action === 'catalogueFetch' ? { catalogue: true, ok: true, status: 200, data: promo } : promo);
  };
}

test('live-source regression: reversed Eevee links resolve to the right stamp, image and price', async () => {
  const input = pokemonVariantRows(promo);
  assert.deepEqual(input.map(row => row.tcgplayerProductId), [610757, 610758], 'upstream links really are reversed');
  const cards = await Promise.all(input.map(row => verifyPokemonProduct({ ...row, price: 999 }, fixtureLookups)));
  assert.deepEqual(cards.map(row => [row.finish, row.tcgplayerProductId, row.price]), [
    ['Holo', 610758, 9.44], ['Holo · Pokemon Center', 610757, 82.7],
  ]);
  assert.match(cards[0].imageLarge, /610758\.jpg$/);
  assert.match(cards[1].imageLarge, /610757\.jpg$/);
  assert.deepEqual(cards.map(printingIdentity), input.map(printingIdentity), 'a repaired product link does not create another holding');
});

test('shared Normal/Reverse products retain finish prices instead of the combined headline', async () => {
  const input = pokemonVariantRows(prismatic).slice(0, 2);
  input[1].price = 3.5;
  const cards = await Promise.all(input.map(row => verifyPokemonProduct(row, fixtureLookups)));
  assert.deepEqual(cards.map(row => row.price), [0.26, 3.5]);
  assert.ok(cards.every(row => row.pokemonImageShared && row.pokemonVerifiedProductId === 610429));
  const empty = await verifyPokemonProduct({ ...input[1], price: null }, fixtureLookups);
  assert.equal(empty.price, null, 'a combined market price cannot fill a missing finish price');
});

test('named pattern products use the verified dedicated price and SKU bucket', async () => {
  const cards = await Promise.all(pokemonVariantRows(prismatic).slice(2, 4).map(row => verifyPokemonProduct(row, fixtureLookups)));
  assert.deepEqual(cards.map(row => row.tcgplayerProductId), [610590, 610691]);
  assert.deepEqual(cards.map(row => row.price), [products[610590].marketPrice, products[610691].marketPrice]);
  assert.ok(cards.every(row => row.pokemonPriceKey === 'holofoil' && !row.pokemonImageShared));
});

test('mismatched product metadata cannot supply a price, photo, or wrong-game result', async () => {
  const [normal, stamped] = pokemonVariantRows(promo);
  assert.equal(pokemonProductMatch(stamped, products[610758]), null);
  for (const change of [{ productLineName: 'Magic' }, { setCode: 'OTHER', setName: 'Another set' },
    { customAttributes: { number: '174' } }, { productName: 'Pikachu - 173' }, { skus: [{ language: 'English', variant: 'Normal' }] }]) {
    assert.equal(pokemonProductMatch(normal, { ...products[610758], ...change }), null);
  }
  const rejected = await verifyPokemonProduct({ ...normal, price: 999, imageUrl: 'https://product-images.tcgplayer.com/610757.jpg' }, { ...fixtureLookups, getProduct: async () => null });
  assert.equal(rejected.price, null);
  assert.equal(rejected.tcgplayerProductId, null);
  assert.equal(rejected.imageLarge, normal.pokemonCatalogImageLarge);
  const retried = await verifyPokemonProduct(rejected, fixtureLookups);
  assert.equal(retried.tcgplayerProductId, 610758, 'stored failed verification can recover');
});

test('unmatched special versions stay unpriced after exact-product discovery', async () => {
  const cosmos = pokemonVariantRows(prismatic).at(-1);
  const result = await verifyPokemonProduct(cosmos, fixtureLookups);
  assert.equal(result.price, null);
  assert.equal(result.pokemonVerifiedProductId, null);
});

test('scan pricing, images, full reports, saved collections and refresh keep the repaired binding', async () => {
  mockLiveSources();
  const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const old = normalizeCardRecord({ ...pokemonVariantRows(promo)[0], price: 82.7, priceSource: 'TCGplayer',
    imageUrl: 'https://product-images.tcgplayer.com/610757.jpg', imageLarge: 'https://product-images.tcgplayer.com/610757.jpg', imageSource: 'tcgplayer' });
  assert.equal(cardPriceNeedsRefresh(old), true);
  const priced = await addTcgplayerPrice(old);
  assert.equal(priced.price, 9.44);
  const shown = await resolveCardProductImage(priced, { checkImage: async () => true });
  assert.match(shown.imageLarge, /610758\.jpg$/);
  addToCollection(shown);
  assert.equal(loadCollection()[0].tcgplayerProductId, 610758);
  const data = await fetchCardData('Eevee', 'pokemon', old);
  assert.deepEqual(data.priceLines, ['Holo: $9.44 market']);
  assert.equal(data.tcgplayerProductId, 610758);
  const updated = applyCollectionPricePatch({ ...old, qty: 2, marketPrice: 82.7 }, pricePatchFromCardData(data));
  assert.equal(updated.marketPrice, 9.44);
  assert.equal(updated.qty, 2);
  assert.match(updated.imageLarge, /610758\.jpg$/);
  assert.equal(updated.tcgplayerProductId, 610758);
  const printing = toPrinting('pokemon', old, data);
  assert.equal(printing.tcgplayerProductId, 610758);
  const report = withCardRecord({ card_name: 'Eevee', game: 'pokemon', printing }, updated);
  assert.equal(report.card.tcgplayerProductId, 610758);
  assert.equal(await resolveProductId(old), 610758, 'price history follows the corrected product');
});

test('older saved rows recover the other candidate link from the exact catalog record', async () => {
  mockLiveSources();
  const legacy = { ...pokemonVariantRows(promo)[1], pokemonProductCandidates: null };
  const verified = await verifyPokemonProduct(legacy);
  assert.equal(verified.tcgplayerProductId, 610757);
  assert.equal(verified.price, 82.7);
});

test('changing the physical version invalidates an earlier product verification', async () => {
  const [normal, stamped] = pokemonVariantRows(promo);
  const verified = await verifyPokemonProduct(normal, fixtureLookups);
  const changed = await verifyPokemonProduct({ ...verified, pokemonVariantKey: stamped.pokemonVariantKey,
    pokemonVariantLabel: stamped.pokemonVariantLabel, finish: stamped.finish }, fixtureLookups);
  assert.equal(changed.tcgplayerProductId, 610757);
  assert.equal(changed.price, 82.7);
});

test('a verified product keeps its full printed number through reports and collection storage', async () => {
  const card = pokemonVariantRows({ id: 'swsh11tg-TG23', name: "Adventurer's Discovery", localId: 'TG23',
    set: { id: 'swsh11tg', name: 'Lost Origin Trainer Gallery', cardCount: { official: 30 } },
    variants_detailed: [{ type: 'holo', thirdParty: { tcgplayer: 284296 } }] })[0];
  const verified = await verifyPokemonProduct(card, { getProduct: async () => ({ productId: 284296, productLineName: 'Pokemon',
    productName: "Adventurer's Discovery", setName: 'Lost Origin Trainer Gallery', setCode: 'SWSH11',
    customAttributes: { number: 'TG23/TG30' }, marketPrice: 3.71, skus: [{ language: 'English', variant: 'Holofoil' }] }) });
  assert.equal(verified.printedTotal, 'TG30');
  assert.equal(verified.number, 'TG23');
  assert.equal(printingIdentity(verified), printingIdentity(card));
  assert.match(printingLabel(toPrinting('pokemon', verified)), /TG23\/TG30/);
  const store = new Map(); globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  addToCollection(verified);
  assert.match(printingLabel(loadCollection()[0]), /TG23\/TG30/);
  assert.equal(loadCollection()[0].marketPrice, 3.71);
});
