import { fetchTcgplayerProduct, searchTcgplayerCatalog } from './tcgplayerProduct.js';
import { mtgFinishLabel, mtgNamedFoils } from './mtgFinish.js';
import { sameCollectorNumber } from './printedIdentity.js';

const key = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const setWords = value => String(value || '').toLowerCase().replace(/universes beyond/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).sort().join(' ');

export function mtgProductIdentity(card, product, partial = false) {
  if (!product || (product.productLineName ? !['magic', 'magicthegathering'].includes(key(product.productLineName)) : !partial)
    || product.sealed || product.duplicate) return false;
  if (!sameCollectorNumber(product.customAttributes?.number || product.number, card.number)) return false;
  const sameSet = card.setId && key(product.setCode) === key(card.setId)
    || card.setName && setWords(product.setName) === setWords(card.setName);
  if (!sameSet) return false;
  const names = [card.name, card.oracleName, ...(card.nameAliases || [])].filter(Boolean).flatMap(name => name.split('//')).map(key);
  const title = String(product.productName || '').replace(/\([^)]*\)/g, '').trim();
  const parts = title.split(/\s+-\s+/).filter(part => !sameCollectorNumber(part, card.number));
  if (!parts.length || !parts.every(part => names.includes(key(part)))) return false;
  const expected = card.form === 'foil' ? mtgFinishLabel(card).split(' / ').map(value => key(value).replace(/fractured/g, 'fracture')).filter(label => label !== 'foil') : [];
  const qualifiers = [...String(product.productName).matchAll(/\(([^)]*)\)/g)].map(match => match[1]).join(' ');
  const actual = mtgNamedFoils(qualifiers);
  if (actual.some(tag => !expected.includes(tag))) return false;
  if (expected.some(tag => !key(qualifiers).includes(tag.replace(/foil$/, '')))) return false;
  // A stamped promo is not interchangeable with the ordinary printing.
  if (/prerelease/i.test(product.productName) && !card.promoTypes?.includes('prerelease')) return false;
  return true;
}

function dedicatedPrice(card, product) {
  if (!mtgProductIdentity(card, product)) return null;
  const variants = [...new Set((product.skus || []).filter(sku => key(sku.language) === 'english').map(sku => key(sku.variant)))];
  if (variants.length !== 1) return null; // A mixed product headline is not a finish price.
  const variant = variants[0];
  const matches = card.form === 'normal' ? ['normal', 'nonfoil'].includes(variant)
    : card.form === 'etched' ? variant.includes('etched')
    : variant.endsWith('foil') && !variant.includes('etched');
  return matches ? positive(product.marketPrice) : null;
}

export async function fillMtgPrice(card, { signal, getProduct = fetchTcgplayerProduct, search = searchTcgplayerCatalog } = {}) {
  if (card?.game !== 'mtg' || !card.form || positive(card.price)) return card;
  if (!card.name || !card.number || (!card.setId && !card.setName)) return card;
  if (signal?.aborted) throw signal.reason || new DOMException('Cancelled', 'AbortError');
  const ownId = card.tcgplayerProductIds?.[card.form] || card.tcgplayerProductId;
  const own = ownId ? await getProduct(ownId, signal) : null;
  let product = own, price = dedicatedPrice(card, own);
  if (!price) {
    // Named foils can have their own marketplace product even when Scryfall
    // links both finishes to the normal-only product. Search within its set.
    const setName = own?.setCode && key(own.setCode) === key(card.setId) ? own.setName : '';
    const rows = await search(card.name, { game: 'mtg', setName, signal });
    const ids = [...new Set(rows.filter(row => mtgProductIdentity(card, row, true)).map(row => Number(row.productId)).filter(id => Number.isSafeInteger(id) && id > 0))];
    const details = await Promise.all(ids.map(id => getProduct(id, signal)));
    const matches = details.map(product => ({ product, price: dedicatedPrice(card, product) })).filter(row => row.price);
    if (matches.length !== 1) return card;
    ({ product, price } = matches[0]);
  }
  if (signal?.aborted) throw signal.reason || new DOMException('Cancelled', 'AbortError');
  const id = Number(product.productId), image = `https://product-images.tcgplayer.com/${id}.jpg`;
  return { ...card, price, marketPrices: { ...card.marketPrices, [card.form]: price },
    priceSource: 'TCGplayer', priceScope: 'exact finish', priceUrl: `https://www.tcgplayer.com/product/${id}`,
    priceCheckedAt: new Date().toISOString(), tcgplayerProductId: id,
    tcgplayerProductIds: { ...card.tcgplayerProductIds, [card.form]: id },
    imageUrl: image, imageLarge: image, tcgplayerImageUrl: image, imageSource: 'tcgplayer',
    imageSharedFinishes: card.imageSharedFinishes || [],
  };
}
