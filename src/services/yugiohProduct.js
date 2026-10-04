import { searchTcgplayerCatalog } from './tcgplayerProduct.js';
import { yugiohBaseName, verifiedYugiohImage, stampYugiohProductImage, productArtVariant, knownRarity } from './cardImageIdentity.js';

const key = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function sameCardPrinting(card, product) {
  if (!card?.name || !card.setName || !card.number || product.sealed || product.duplicate) return false;
  if (product.productLineName && key(product.productLineName).replace(/ /g, '') !== 'yugioh') return false;
  return key(yugiohBaseName(product.productName)) === key(yugiohBaseName(card.baseName || card.name))
    && key(product.setName) === key(card.setName)
    && key(product.number || product.customAttributes?.number) === key(card.number)
    && knownRarity(product.rarityName || product.customAttributes?.rarityDbName)
    && Number.isSafeInteger(Number(product.productId)) && Number(product.productId) > 0;
}
function uniqueProducts(card, products) {
  return [...new Map((products || []).filter(product => sameCardPrinting(card, product))
    .map(product => [Number(product.productId), product])).values()];
}
export function matchingYugiohProduct(card, products) {
  const all = uniqueProducts(card, products);
  // A known product separates standard and extended art even when their
  // printed number AND rarity are identical.
  if (card?.tcgplayerProductId) {
    const own = all.find(product => Number(product.productId) === Number(card.tcgplayerProductId));
    if (own && (!knownRarity(card.rarity) || key(own.rarityName || own.customAttributes?.rarityDbName) === key(card.rarity))) return own;
    return null;
  }
  if (!knownRarity(card?.rarity)) return null;
  const variant = card.artVariant || (card.tcgplayerProductName ? productArtVariant(card.tcgplayerProductName) : null);
  const matches = all.filter(product => key(product.rarityName || product.customAttributes?.rarityDbName) === key(card.rarity)
    && (!variant || key(productArtVariant(product.productName)) === key(variant)));
  return matches.length === 1 ? matches[0] : null;
}
export function yugiohProductVersion(card, product, { updatePrice = false } = {}) {
  const productId = Number(product.productId);
  const price = Number(product.marketPrice);
  const rarity = product.rarityName || product.customAttributes?.rarityDbName;
  return stampYugiohProductImage({
    ...card,
    name: yugiohBaseName(product.productName),
    baseName: yugiohBaseName(product.productName),
    number: product.number || product.customAttributes?.number,
    setName: product.setName,
    rarity,
    artVariant: productArtVariant(product.productName),
    tcgplayerProductName: product.productName,
    tcgplayerProductId: productId,
    printingId: `tcgplayer:${productId}`,
    ...(updatePrice ? { price: price > 0 ? price : null, marketPrices: { normal: price > 0 ? price : null },
      priceSource: price > 0 ? 'TCGplayer' : null, priceUrl: `https://www.tcgplayer.com/product/${productId}`,
      priceCheckedAt: new Date().toISOString() } : {}),
  });
}
export function reconcileYugiohVersions(cards, products) {
  const anchor = cards[0];
  if (!anchor) return [];
  const actual = uniqueProducts(anchor, products);
  if (actual.length) return actual.map(product => yugiohProductVersion(anchor, product, { updatePrice: true }));
  // A provider's placeholder such as "New" is not a physical rarity.
  return cards.filter(card => knownRarity(card.rarity));
}
export async function resolveYugiohProductImage(card, { signal, search = searchTcgplayerCatalog } = {}) {
  if (card?.game !== 'yugioh' || verifiedYugiohImage(card) && card.artVariant) return card;
  const fallback = verifiedYugiohImage(card) ? card : { ...card, imageUrl: null, imageLarge: null, tcgplayerImageUrl: null, imageIdentity: null, imageSource: null, imageStatus: 'unavailable' };
  if (!card.name || !card.setName || !card.number) return fallback;
  try {
    const products = await search(yugiohBaseName(card.baseName || card.name), { game: 'yugioh', setName: card.setName, signal });
    const product = matchingYugiohProduct(card, products);
    return product ? yugiohProductVersion(card, product) : fallback;
  } catch (error) {
    if (signal?.aborted) throw error;
    return fallback;
  }
}
export async function resolveYugiohProductImages(cards, { signal, search = searchTcgplayerCatalog } = {}) {
  const groups = new Map();
  for (const card of cards) {
    const identity = [key(yugiohBaseName(card.name)), key(card.setName), key(card.number)].join('::');
    if (!groups.has(identity)) groups.set(identity, []);
    groups.get(identity).push(card);
  }
  const inputs = [...groups.values()], outputs = new Array(inputs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, inputs.length) }, async () => {
    while (next < inputs.length) {
      const index = next++, group = inputs[index], card = group[0];
      try {
        const products = await search(yugiohBaseName(card.name), { game: 'yugioh', setName: card.setName, signal });
        outputs[index] = reconcileYugiohVersions(group, products);
      } catch (error) { if (signal?.aborted) throw error; outputs[index] = group.filter(row => knownRarity(row.rarity)); }
    }
  }));
  return outputs.flat();
}
