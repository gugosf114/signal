import { fetchWithTimeout } from './http.js';

const PRODUCT_LINE = {
  pokemon: 'Pokemon',
  mtg: 'Magic',
  yugioh: 'YuGiOh',
};

const clean = (value) => String(value || '').trim();
const key = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function selectTcgplayerPrice(details, printing) {
  const wantedName = key(printing?.name);
  const wantedSet = key(printing?.setName);
  const wantedNumber = key(printing?.number || printing?.setCode);
  const wantedRarity = key(printing?.rarity);

  const matches = (Array.isArray(details) ? details : []).filter((item) => {
    const productName = key(item?.productName).replace(/ starlight rare$| secret rare$| ultra rare$/g, '').trim();
    const number = key(item?.customAttributes?.number);
    const rarity = key(item?.rarityName || item?.customAttributes?.rarityDbName);
    return productName === wantedName
      && (!wantedSet || key(item?.setName) === wantedSet)
      && (!wantedNumber || number === wantedNumber)
      && (!wantedRarity || rarity === wantedRarity);
  });

  if (matches.length !== 1) return null;
  const item = matches[0];
  const price = positiveNumber(item.marketPrice);
  if (!price) return null;
  const productId = Number(item.productId);
  return {
    price,
    low: positiveNumber(item.lowestPrice),
    median: positiveNumber(item.medianPrice),
    source: 'TCGplayer',
    productId: Number.isFinite(productId) ? productId : null,
    url: Number.isFinite(productId) ? `https://www.tcgplayer.com/product/${productId}` : null,
  };
}

export async function fetchTcgplayerPrice(printing, signal) {
  const line = PRODUCT_LINE[printing?.game];
  const name = clean(printing?.name);
  if (!line || !name) return null;

  const autocomplete = await fetchWithTimeout(
    `https://data.tcgplayer.com/autocomplete?q=${encodeURIComponent(name)}`
      + `&product-line-affinity=${encodeURIComponent(line)}&algorithm=product_line_affinity`,
    { signal },
    8000,
  );
  if (!autocomplete.ok) return null;
  const search = await autocomplete.json();
  const wantedSet = key(printing.setName);
  const candidates = (search?.products || [])
    .filter((product) => !wantedSet || key(product['set-name']) === wantedSet)
    .slice(0, 8);
  if (!candidates.length) return null;

  const details = await Promise.all(candidates.map(async (product) => {
    const productId = Number(product['product-id']);
    if (!Number.isFinite(productId)) return null;
    try {
      const response = await fetchWithTimeout(
        `https://mp-search-api.tcgplayer.com/v2/product/${productId}/details`,
        { signal },
        8000,
      );
      return response.ok ? response.json() : null;
    } catch {
      return null;
    }
  }));

  return selectTcgplayerPrice(details.filter(Boolean), printing);
}

export async function addTcgplayerPrice(printing, signal) {
  if (!printing || positiveNumber(printing.price)) return printing;
  try {
    const result = await fetchTcgplayerPrice(printing, signal);
    return result ? {
      ...printing,
      price: result.price,
      marketPrices: { ...(printing.marketPrices || {}), normal: result.price },
      priceSource: result.source,
      priceUrl: result.url,
      tcgplayerProductId: result.productId,
    } : printing;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return printing;
  }
}
