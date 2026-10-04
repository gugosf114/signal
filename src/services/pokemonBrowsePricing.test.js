import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePokemonBrowseVariants, verifyPokemonProduct } from './pokemonProduct.js';
import { fetchTcgplayerProduct } from './tcgplayerProduct.js';

const card = { game: 'pokemon', id: 'sample-001', name: 'Examplemon', number: '001', printedTotal: '100', setId: 'sample', setName: 'Example Set', form: 'normal', finish: 'Normal', price: null, pokemonVariantsResolved: true, pokemonVariantGenerated: true, pokemonProductCandidates: [] };
const product = { productId: 900001, productLineName: 'Pokemon', productName: 'Examplemon - 001/100', setName: 'SV: Example Set', customAttributes: { number: '001/100' }, marketPrice: 9.81, skus: [{ language: 'English', condition: 'Near Mint', variant: 'Holofoil' }] };
const options = { searchProducts: async () => [product], getProduct: async () => product, getSkuMarket: async () => null };

test('finds the exact product when the catalogue supplies no price or product ID', async () => {
  const rows = await resolvePokemonBrowseVariants(card, options);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, 9.81);
  assert.equal(rows[0].form, 'holo');
  assert.equal(rows[0].pokemonVerifiedProductId, product.productId);
});

test('a bounded name retry still requires the exact set and printed number', async () => {
  const queries = [];
  const rows = await resolvePokemonBrowseVariants(card, { ...options, searchProducts: async query => {
    queries.push(query); return query === card.name ? [product] : [];
  } });
  assert.equal(queries.length, 2);
  assert.equal(rows[0].price, 9.81);
  for (const wrong of [{ ...product, setName: 'Other Set' }, { ...product, customAttributes: { number: '002/100' } }]) {
    const missing = await resolvePokemonBrowseVariants(card, { ...options, searchProducts: async () => [wrong] });
    assert.equal(missing[0].price, null);
  }
});

test('normal and reverse prices come from their own SKU, never the combined price', async () => {
  const mixed = { ...product, marketPrice: 999, skus: ['Normal', 'Reverse Holofoil'].map(variant => ({ variant, language: 'English', condition: 'Near Mint' })) };
  const rows = await resolvePokemonBrowseVariants(card, { searchProducts: async () => [mixed], getProduct: async () => mixed,
    getSkuMarket: async (id, variant) => ({ price: variant === 'normal' ? 1.25 : 3.75 }) });
  assert.deepEqual(rows.map(row => [row.form, row.price]), [['normal', 1.25], ['reverse', 3.75]]);
  const absent = await resolvePokemonBrowseVariants(card, { searchProducts: async () => [mixed], getProduct: async () => mixed, getSkuMarket: async () => null });
  assert.ok(absent.every(row => row.price === null));
});

test('a confirmed physical finish is never silently changed to another finish', async () => {
  const fixed = await verifyPokemonProduct({ ...card, pokemonVariantGenerated: false, tcgplayerProductId: product.productId }, options);
  assert.equal(fixed.form, 'normal');
  assert.equal(fixed.price, null);
});

test('product details use the server when the browser cannot access TCGplayer', async () => {
  const original = globalThis.fetch;
  let relayed = false;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('mp-search-api.tcgplayer.com')) throw new TypeError('Blocked by browser access rules');
    const body = JSON.parse(init.body);
    assert.equal(body.action, 'catalogueFetch');
    assert.match(body.url, /\/v2\/product\/900099\/details$/);
    relayed = true;
    return new Response(JSON.stringify({ catalogue: true, ok: true, status: 200, data: { ...product, productId: 900099 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    assert.equal((await fetchTcgplayerProduct(900099))?.productId, 900099);
    assert.equal(relayed, true);
  } finally { globalThis.fetch = original; }
});


test('older catalogue rows can discover missing prices without erasing existing prices', async () => {
  const legacy = { ...card, pokemonVariantsResolved: false, pokemonVariantGenerated: undefined, availableFinishes: [] };
  assert.equal((await resolvePokemonBrowseVariants(legacy, options))[0].price, 9.81);
  const existing = { ...legacy, price: 2.5 };
  assert.equal((await resolvePokemonBrowseVariants(existing, { searchProducts: async () => { throw Error('must keep existing price'); } }))[0].price, 2.5);
});
