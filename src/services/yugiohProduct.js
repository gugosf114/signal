import { searchTcgplayerCatalog } from './tcgplayerProduct.js';
import { yugiohBaseName, verifiedYugiohImage, stampYugiohProductImage } from './cardImageIdentity.js';

const key = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function matchingYugiohProduct(card, products) {
  if (!card?.name || !card.setName || !card.number || !card.rarity) return null;
  const matches = (products || []).filter(product => {
    if (product.sealed || product.duplicate) return false;
    if (product.productLineName && key(product.productLineName).replace(/ /g, '') !== 'yugioh') return false;
    return key(yugiohBaseName(product.productName)) === key(yugiohBaseName(card.baseName || card.name))
      && key(product.setName) === key(card.setName)
      && key(product.number || product.customAttributes?.number) === key(card.number)
      && key(product.rarityName || product.customAttributes?.rarityDbName) === key(card.rarity)
      && Number.isSafeInteger(Number(product.productId)) && Number(product.productId) > 0;
  });
  const unique = [...new Map(matches.map(product => [Number(product.productId), product])).values()];
  return unique.length === 1 ? unique[0] : null;
}
// Product identity owns the picture, regardless of whether a price is present.
export async function resolveYugiohProductImage(card, { signal, search = searchTcgplayerCatalog } = {}) {
  if (card?.game !== 'yugioh' || verifiedYugiohImage(card)) return card;
  const unavailable = { ...card, imageUrl: null, imageLarge: null, tcgplayerImageUrl: null, imageIdentity: null, imageSource: null, imageStatus: 'unavailable' };
  if (!card.name || !card.setName || !card.number || !card.rarity) return unavailable;
  try {
    const products = await search(yugiohBaseName(card.baseName || card.name), { game: 'yugioh', setName: card.setName, signal });
    const product = matchingYugiohProduct(card, products);
    if (!product) return unavailable;
    return stampYugiohProductImage({ ...card, tcgplayerProductId: Number(product.productId) });
  } catch (error) {
    if (signal?.aborted) throw error;
    return unavailable;
  }
}
export async function resolveYugiohProductImages(cards, options = {}) {
  const rows = [...cards];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
    while (next < rows.length) { const index = next++; rows[index] = await resolveYugiohProductImage(rows[index], options); }
  }));
  return rows;
}
