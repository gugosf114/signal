import { fetchWithTimeout } from './http.js';
import { fetchCatalogueJSON } from './signalGateway.js';
import { sameCollectorNumber, scannedSetMatches } from './printedIdentity.js';
import { selectedPokemonVariant } from './pokemonVariants.js';
import { toTcgdexId } from './pokemonIds.js';
import { fetchTcgplayerProduct as fetchPokemonProduct, searchTcgplayerCatalog, fetchTcgplayerSkuMarket } from './tcgplayerProduct.js';

const TTL = 5 * 60 * 1000;
const key = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const idNumber = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const SKU_FORMS = { normal: ['normal'], holo: ['holofoil'], reverse: ['reverseholofoil'],
  first_edition_normal: ['1stedition', '1steditionnormal'], first_edition_holo: ['1steditionholofoil'],
  unlimited_normal: ['unlimited', 'unlimitednormal'], unlimited_holo: ['unlimitedholofoil'] };
const PRICE_KEYS = { normal: 'normal', holofoil: 'holofoil', reverseholofoil: 'reverse-holofoil',
  '1stedition': '1st-edition-normal', '1steditionnormal': '1st-edition-normal', '1steditionholofoil': '1st-edition-holofoil',
  unlimited: 'unlimited-normal', unlimitednormal: 'unlimited-normal', unlimitedholofoil: 'unlimited-holofoil' };
const binding = card => JSON.stringify([card.id || card.catalogId || card.printingId, key(card.name),
  card.setId, card.setCode, card.setName, card.number, card.form, card.pokemonVariantKey, card.tcgplayerProductId]);

// Match the physical version, not merely its catalog-provided product ID.
// The qualifiers come from the same version key used by Collection identity.
export function pokemonProductMatch(card, product, { ignoreFinish = false } = {}) {
  if (key(product?.productLineName) !== 'pokemon' || product?.sealed === true) return null;
  const title = String(product.productName || '');
  const baseName = title.replace(/(?:\s*\([^)]*\))+\s*$/, '')
    .replace(/\s+-\s+[A-Za-z]*\d+[A-Za-z]?(?:\/[A-Za-z]*\d+[A-Za-z]?)?\s*$/, '');
  if (key(baseName) !== key(card.name)) return null;
  if (!sameCollectorNumber(String(product.customAttributes?.number || product.number || '').split('/')[0], card.number)) return null;
  const productSet = { setCode: product.setCode, setName: String(product.setName || '').replace(/^[A-Z0-9]{1,8}:\s*/, '') };
  if (![card.setId, card.setCode, card.setName].filter(Boolean).some(set => scannedSetMatches(productSet, set))) return null;

  let traits = [];
  try { if (card.pokemonVariantKey) traits = JSON.parse(card.pokemonVariantKey).flat().filter(Boolean).map(key); } catch { return null; }
  let qualifiers = key([...title.matchAll(/\(([^)]*)\)/g)].map(match => match[1]).join(' '));
  for (const trait of traits) {
    if (!qualifiers.includes(trait)) return null;
    qualifiers = qualifiers.replace(trait, '');
  }
  qualifiers = qualifiers.replace(/exclusive|pattern|reverseholofoil|reverseholo|holofoil|holo|nonfoil|foil|1stedition|unlimited/g, '');
  if (qualifiers) return null; // An unaccounted stamp/treatment is a different version.
  const variants = [...new Set((product.skus || []).filter(sku => key(sku.language) === 'english').map(sku => key(sku.variant)))];
  if (ignoreFinish) return { variants };
  const allowed = SKU_FORMS[card.form] || [];
  let finish = variants.find(variant => allowed.includes(variant));
  // A dedicated Master Ball/Cosmos product can sell a reverse holo in its
  // sole Holofoil bucket. Its named treatment was verified above.
  if (!finish && traits.length && variants.length === 1 && variants[0] === 'holofoil' && card.form === 'reverse') finish = variants[0];
  return finish ? { priceKey: PRICE_KEYS[finish], variant: finish, shared: variants.length > 1 } : null;
}

async function restoreContext(card, signal) {
  if (Array.isArray(card.pokemonProductCandidates) && typeof card.pokemonVariantGenerated === 'boolean') return card;
  const id = toTcgdexId(card.catalogId || card.id || card.printingId);
  if (!id) return card;
  const url = `https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(id)}`;
  let data;
  try { data = await fetchCatalogueJSON(url, signal); } catch {
    if (signal?.aborted) throw signal.reason;
    try {
      const response = await fetchWithTimeout(url, { signal }, 6000);
      if (response.ok) data = await response.json();
    } catch { if (signal?.aborted) throw signal.reason; }
  }
  const selected = data && selectedPokemonVariant(data, card);
  return selected ? { ...card, ...selected } : card;
}

function catalogPhoto(card) {
  const safe = url => url && !String(url).includes('product-images.tcgplayer.com') ? url : null;
  return {
    imageUrl: card.pokemonCatalogImageUrl || safe(card.imageUrl),
    imageLarge: card.pokemonCatalogImageLarge || safe(card.imageLarge) || card.pokemonCatalogImageUrl || safe(card.imageUrl),
    imageSource: 'exact-catalogue', pokemonImageShared: true,
  };
}

const FORM_LABELS = { normal: 'Normal', holo: 'Holo', reverse: 'Reverse holo', first_edition_normal: '1st Edition Normal', first_edition_holo: '1st Edition Holo', unlimited_normal: 'Unlimited Normal', unlimited_holo: 'Unlimited Holo' };
function productForms(product) {
  const variants = new Set((product.skus || []).filter(sku => key(sku.language) === 'english').map(sku => key(sku.variant)));
  return Object.entries(SKU_FORMS).filter(([, names]) => names.some(name => variants.has(name))).map(([form]) => form);
}
function withConfirmedForm(card, form) {
  return { ...card, form, finish: FORM_LABELS[form], pokemonVariantLabel: FORM_LABELS[form], pokemonVariantGenerated: false,
    availableFinishes: [form], price: form === card.form ? card.price : null, pokemonPriceKey: form === card.form ? card.pokemonPriceKey : null };
}
export async function discoverPokemonProducts(card, { signal, getProduct = fetchPokemonProduct, searchProducts = searchTcgplayerCatalog } = {}) {
  const number = card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number;
  let found = await searchProducts(`${card.name} ${number || ''}`.trim(), { game: 'pokemon', setName: card.setName || '', signal });
  if (!(found || []).some(product => pokemonProductMatch(card, product, { ignoreFinish: true }))) {
    found = await searchProducts(card.name, { game: 'pokemon', setName: card.setName || '', signal });
  }
  const ids = [...new Set((found || []).filter(product => pokemonProductMatch(card, product, { ignoreFinish: true }))
    .map(product => idNumber(product.productId)).filter(Boolean))];
  return (await Promise.all(ids.map(id => getProduct(id, signal)))).filter(product => product
    && ids.includes(idNumber(product.productId)) && pokemonProductMatch(card, product, { ignoreFinish: true }));
}
export async function resolvePokemonBrowseVariants(input, options = {}) {
  if (input?.game !== 'pokemon') return [input];
  if (!input.pokemonVariantsResolved) {
    if (positive(input.price)) return [input];
    input = { ...input, pokemonVariantsResolved: true, pokemonVariantGenerated: !(input.availableFinishes || []).length,
      pokemonVariantKey: null, pokemonProductCandidates: input.tcgplayerProductId ? [input.tcgplayerProductId] : [] };
  }
  if (!input.pokemonVariantGenerated) return [await verifyPokemonProduct(input, options)];
  const details = await discoverPokemonProducts(input, options);
  if (!details.length) return [input];
  const rows = [];
  for (const product of details) {
    for (const form of productForms(product)) {
      const card = { ...withConfirmedForm(input, form), tcgplayerProductId: product.productId,
        pokemonCatalogProductId: product.productId, pokemonProductCandidates: [product.productId] };
      rows.push(await verifyPokemonProduct(card, { ...options, getProduct: async id => details.find(row => row.productId === id) || null, searchProducts: async () => [] }));
    }
  }
  return rows.length ? rows : [input];
}

export async function verifyPokemonProduct(input, { signal, refresh = false, getProduct = fetchPokemonProduct, searchProducts = searchTcgplayerCatalog, getSkuMarket = fetchTcgplayerSkuMarket } = {}) {
  if (input?.game !== 'pokemon' || !input.pokemonVariantsResolved) return input;
  if (signal?.aborted) throw signal.reason || new DOMException('Cancelled', 'AbortError');
  const age = Date.now() - new Date(input.pokemonProductCheckedAt || '').getTime();
  if (!refresh && input.pokemonVerifiedProductId && input.pokemonVerifiedProductId === input.tcgplayerProductId
    && input.pokemonProductBinding === binding(input) && age >= 0 && age < TTL) return input;
  let card = await restoreContext(input, signal);
  const candidates = [...new Set([card.tcgplayerProductId, card.pokemonCatalogProductId, ...(card.pokemonProductCandidates || [])].map(idNumber).filter(Boolean))];
  let details = await Promise.all(candidates.map(async id => {
    const product = await getProduct(id, signal);
    return idNumber(product?.productId) === id ? product : null;
  }));
  if (!details.some(product => product && pokemonProductMatch(card, product, { ignoreFinish: true }))) {
    details = await discoverPokemonProducts(card, { signal, getProduct, searchProducts });
  }
  if (card.pokemonVariantGenerated && details.length === 1) {
    const forms = productForms(details[0]);
    if (forms.length === 1) card = withConfirmedForm(card, forms[0]);
  }
  if (signal?.aborted) throw signal.reason || new DOMException('Cancelled', 'AbortError');
  const matches = details.filter(Boolean).map(product => ({ product, match: pokemonProductMatch(card, product) })).filter(row => row.match);
  const checked = new Date().toISOString();
  if (matches.length !== 1) return { ...card, ...catalogPhoto(card),
    price: null, marketPrices: { [card.form]: null }, priceSource: null, priceUrl: null,
    tcgplayerProductId: null, tcgplayerImageUrl: null, pokemonVerifiedProductId: null,
    pokemonProductCheckedAt: checked, pokemonProductBinding: null, pokemonPriceKey: null, priceCheckedAt: checked,
  };
  const { product, match } = matches[0];
  const id = idNumber(product.productId);
  // Never substitute a product's combined headline price for Normal/Reverse.
  let price = match.shared
    ? (id === card.tcgplayerProductId && card.pokemonPriceKey === match.priceKey ? positive(card.price) : null)
    : positive(product.marketPrice);
  if (price === null) {
    const exact = await getSkuMarket(id, match.variant, { signal }).catch(() => null);
    price = positive(exact?.price);
  }
  const image = `https://product-images.tcgplayer.com/${id}.jpg`;
  const denominator = String(product.customAttributes?.number || product.number || '').split('/')[1]?.trim();
  const printedTotal = denominator && /^[A-Z]*\d+$/i.test(denominator) ? denominator.toUpperCase() : card.printedTotal;
  return { ...card, tcgplayerProductId: id, pokemonVerifiedProductId: id, pokemonProductCheckedAt: checked,
    printedTotal,
    pokemonProductBinding: binding({ ...card, tcgplayerProductId: id }),
    pokemonPriceKey: match.priceKey, pokemonProductImageShared: match.shared, pokemonImageShared: match.shared,
    priceCheckedAt: checked,
    price, marketPrices: { [card.form]: price }, priceSource: price === null ? null : 'TCGplayer',
    priceUrl: `https://www.tcgplayer.com/product/${id}`, priceScope: 'exact finish',
    imageUrl: image, imageLarge: image, tcgplayerImageUrl: image, imageSource: 'tcgplayer',
  };
}

export function pokemonCatalogPhoto(card) { return { ...card, ...catalogPhoto(card) }; }
