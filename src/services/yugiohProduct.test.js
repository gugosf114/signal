import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchingYugiohProduct, resolveYugiohProductImage } from './yugiohProduct.js';
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
  assert.deepEqual(rows.map(row => cardVersionLabel(row)), ['Secret Rare', 'Starlight Rare', 'Ultra Rare']);
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
