import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchingYugiohProduct, resolveYugiohProductImage, reconcileYugiohVersions } from './yugiohProduct.js';
import { verifiedYugiohImage, cardVersionLabel } from './cardImageIdentity.js';
import { normalizeCardRecord } from './cardRecord.js';

const card = { game: 'yugioh', name: 'Example Dragon', id: '12345678', setName: 'Example Set', number: 'EXAM-EN001', rarity: 'Secret Rare' };
const product = { productId: 1234, productLineName: 'YuGiOh', productName: 'Example Dragon (Secret Rare)', setName: 'Example Set', number: 'EXAM-EN001', rarityName: 'Secret Rare', marketPrice: 0 };

test('matching uses the name, expansion, printed number and rarity', () => {
  assert.equal(matchingYugiohProduct(card, [product]), product);
  for (const patch of [{ productName: 'Other Dragon' }, { setName: 'Other Set' }, { number: 'EXAM-EN002' }, { rarityName: 'Starlight Rare' }]) {
    assert.equal(matchingYugiohProduct(card, [{ ...product, ...patch }]), null);
  }
  assert.equal(matchingYugiohProduct(card, [product, { ...product, productId: 5678 }]), null);
});

test('an exact product image does not require a market price', async () => {
  const resolved = await resolveYugiohProductImage(card, { search: async () => [product] });
  assert.equal(resolved.imageUrl, 'https://product-images.tcgplayer.com/1234.jpg');
  assert.equal(verifiedYugiohImage(normalizeCardRecord(resolved)), true);
});

test('different rarities resolve different product photos without card-specific exceptions', async () => {
  const products = ['Secret Rare', 'Starlight Rare', 'Ultra Rare'].map((rarityName, index) => ({ ...product, rarityName, productId: 1000 + index }));
  const rows = await Promise.all(products.map(row => resolveYugiohProductImage({ ...card, rarity: row.rarityName }, { search: async () => products })));
  assert.equal(new Set(rows.map(row => row.imageUrl)).size, 3);
  assert.deepEqual(rows.map(row => cardVersionLabel(row)), ['Secret Rare · Standard art', 'Starlight Rare · Standard art', 'Ultra Rare · Standard art']);
});

test('unmatched versions cannot retain a generic or neighbouring image', async () => {
  const resolved = await resolveYugiohProductImage({ ...card, imageUrl: 'https://example.com/generic.jpg' }, { search: async () => [] });
  assert.equal(resolved.imageUrl, null);
  assert.equal(resolved.imageStatus, 'unavailable');
  const matched = await resolveYugiohProductImage(card, { search: async () => [product] });
  const changed = normalizeCardRecord({ ...matched, rarity: 'Ultra Rare' });
  assert.equal(changed.imageUrl, null);
});

test('version labels preserve rarity and finish for other games too', () => {
  assert.equal(cardVersionLabel({ rarity: 'Mythic', finish: 'Etched foil' }), 'Mythic · Etched foil');
  assert.equal(cardVersionLabel({ rarity: 'Illustration Rare', finish: 'Holo' }), 'Illustration Rare · Holo');
});

// A catalogue placeholder and two real products with one rarity caused blank tiles.
test('reconciles placeholder rows into every real product and preserves artwork variants', () => {
  const products = [
    { ...product, productId: 2001, productName: 'Example Dragon', rarityName: 'Ultra Rare' },
    { ...product, productId: 2002, productName: 'Example Dragon (Extended Art)', rarityName: 'Ultra Rare' },
    { ...product, productId: 2003, productName: 'Example Dragon (GMR)', rarityName: 'Grand Master Rare' },
    { ...product, productId: 2004, productName: 'Example Dragon (Starlight Rare) (Extended Art)', rarityName: 'Starlight Rare' },
  ];
  const rows = reconcileYugiohVersions(['New', 'Ultra Rare', 'Starlight Rare'].map(rarity => ({ ...card, rarity })), products);
  assert.equal(rows.length, 4);
  assert.equal(new Set(rows.map(row => row.imageUrl)).size, 4);
  assert.equal(rows.some(row => row.rarity === 'New'), false);
  assert.deepEqual(rows.filter(row => row.rarity === 'Ultra Rare').map(row => row.artVariant), ['Standard art', 'Extended art']);
  for (const row of rows) assert.equal(verifiedYugiohImage(normalizeCardRecord(row)), true);
  assert.equal(matchingYugiohProduct({ ...card, rarity: 'Ultra Rare', tcgplayerProductId: 2002 }, products)?.productId, 2002);
});

test('a failed recheck cannot erase an already verified picture', async () => {
  const matched = await resolveYugiohProductImage(card, { search: async () => [product] });
  const old = { ...matched, artVariant: null };
  const result = await resolveYugiohProductImage(old, { search: async () => [] });
  assert.equal(result.imageUrl, old.imageUrl);
  assert.deepEqual(reconcileYugiohVersions([{ ...card, rarity: 'New' }], []), []);
});
