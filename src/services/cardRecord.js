// One exact card shape for every door and every screen.
// Catalogue rows, scans, saved cards, cache hits, and reports all become this
// record before they can start a full Signal or be saved.

export const CARD_RECORD_VERSION = 1;
export const CARD_PRICE_TTL_MS = 24 * 60 * 60 * 1000;

const GAMES = new Set(['pokemon', 'mtg', 'yugioh']);
const FINISH_LABELS = {
  normal: 'Normal',
  holo: 'Holo',
  reverse: 'Reverse Holo',
  first_edition_normal: '1st Edition Normal',
  first_edition_holo: '1st Edition Holo',
  unlimited_normal: 'Unlimited Normal',
  unlimited_holo: 'Unlimited Holo',
  foil: 'Foil',
  etched: 'Etched',
};

function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

export function cardPriceNumber(value) {
  if (typeof value === 'string') {
    const match = value.match(/(?:USD\s*)?\$\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (match) value = match[1].replace(/,/g, '');
  }
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cleanPrices(value) {
  if (!value || typeof value !== 'object') return null;
  const entries = Object.entries(value)
    .map(([form, price]) => [clean(form), cardPriceNumber(price)])
    .filter(([form]) => form);
  return entries.length ? Object.fromEntries(entries) : null;
}

function cleanList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(clean).filter(Boolean))];
}

function cleanDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeCardRecord(input = {}, fallback = {}) {
  const current = input && typeof input === 'object' ? input : {};
  const prior = fallback && typeof fallback === 'object' ? fallback : {};
  const game = clean(first(current.game, prior.game)).toLowerCase();
  const name = clean(first(current.name, current.card_name, prior.name, prior.card_name));
  if (!name || !GAMES.has(game)) return null;

  const id = clean(first(current.id, current.catalogId, prior.id, prior.catalogId)) || null;
  const printingId = clean(first(current.printingId, prior.printingId, game !== 'yugioh' ? id : null)) || null;
  const availableFinishes = cleanList(first(current.availableFinishes, prior.availableFinishes));
  let form = game === 'yugioh' ? null : clean(first(current.form, prior.form)) || null;
  if (!form && availableFinishes.length === 1) form = availableFinishes[0];
  const defaultFinish = game === 'mtg' && form === 'normal' ? 'Non-foil' : FINISH_LABELS[form];
  const finish = game === 'yugioh'
    ? null
    : clean(first(current.finish, prior.finish, defaultFinish)) || null;
  const marketPrices = cleanPrices(first(current.marketPrices, prior.marketPrices));
  const suppliedPrice = first(
    current.price,
    current.marketPrice,
    current.enPrice,
    prior.price,
    prior.marketPrice,
    prior.enPrice,
  );
  const price = cardPriceNumber(suppliedPrice) ?? cardPriceNumber(marketPrices?.[form]);
  const explicitlyBroad = current.pinned === false || (current.pinned === undefined && prior.pinned === false);

  return {
    recordVersion: CARD_RECORD_VERSION,
    name,
    game,
    id,
    catalogId: clean(first(current.catalogId, prior.catalogId, id)) || null,
    printingId,
    setName: clean(first(current.setName, current.set, prior.setName, prior.set)) || null,
    setId: clean(first(current.setId, prior.setId)) || null,
    setCode: clean(first(current.setCode, prior.setCode)) || null,
    sourceCode: clean(first(current.sourceCode, prior.sourceCode)) || null,
    setLogoUrl: clean(first(current.setLogoUrl, prior.setLogoUrl)) || null,
    number: clean(first(
      current.number,
      game === 'yugioh' ? current.setCode : null,
      prior.number,
      game === 'yugioh' ? prior.setCode : null,
    )) || null,
    printedTotal: clean(first(current.printedTotal, prior.printedTotal)) || null,
    rarity: clean(first(current.rarity, prior.rarity)) || null,
    form,
    finish,
    availableFinishes,
    imageUrl: clean(first(current.imageUrl, prior.imageUrl)) || null,
    imageLarge: clean(first(current.imageLarge, prior.imageLarge, current.imageUrl, prior.imageUrl)) || null,
    imageSource: clean(first(current.imageSource, prior.imageSource)) || null,
    scanImagePath: clean(first(current.scanImagePath, prior.scanImagePath)) || null,
    price,
    marketPrices,
    priceSource: clean(first(current.priceSource, prior.priceSource)) || null,
    priceUrl: clean(first(current.priceUrl, prior.priceUrl)) || null,
    priceCheckedAt: cleanDate(first(current.priceCheckedAt, current.price_checked_at, prior.priceCheckedAt, prior.price_checked_at)),
    tcgplayerProductId: cardPriceNumber(first(current.tcgplayerProductId, prior.tcgplayerProductId)),
    tcgplayerImageUrl: clean(first(current.tcgplayerImageUrl, prior.tcgplayerImageUrl)) || null,
    source: clean(first(current.source, prior.source)) || null,
    releaseDate: clean(first(current.releaseDate, prior.releaseDate)) || null,
    pinned: explicitlyBroad ? false : Boolean(printingId),
  };
}

export function cardRecordFromResult(result, fallback = null) {
  if (!result || typeof result !== 'object') return normalizeCardRecord(fallback || {});
  const layers = [result.printing, result.card, result._pin, fallback]
    .filter((value) => value && typeof value === 'object');
  const legacy = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      if (Array.isArray(value) && value.length === 0) continue;
      if (value !== undefined && value !== null && value !== '') legacy[key] = value;
    }
  }
  const wasBroad = layers.some((layer) => layer.pinned === false);
  const prices = result.prices && typeof result.prices === 'object' ? result.prices : {};
  const hasHeadlinePrice = Object.prototype.hasOwnProperty.call(prices, 'en_price');
  const fallbackRecord = normalizeCardRecord(fallback || {});
  const resultChecked = new Date(prices.price_checked_at || legacy.priceCheckedAt || '').getTime();
  const fallbackChecked = new Date(fallbackRecord?.priceCheckedAt || '').getTime();
  const fallbackIsNewer = Number.isFinite(fallbackChecked)
    && (!Number.isFinite(resultChecked) || fallbackChecked > resultChecked);
  const resolvedPrice = fallbackIsNewer
    ? fallbackRecord.price
    : (hasHeadlinePrice ? cardPriceNumber(prices.en_price) : legacy.price);
  const card = normalizeCardRecord({
    ...legacy,
    name: result.card_name || legacy.name,
    game: result.game || legacy.game,
    price: resolvedPrice,
    marketPrice: resolvedPrice,
    priceSource: fallbackIsNewer
      ? fallbackRecord.priceSource
      : (hasHeadlinePrice ? (prices.price_source || null) : legacy.priceSource),
    priceCheckedAt: fallbackIsNewer
      ? fallbackRecord.priceCheckedAt
      : (prices.price_checked_at || legacy.priceCheckedAt),
  });
  const unavailable = card && resolvedPrice === null && (hasHeadlinePrice || fallbackIsNewer)
    ? {
        ...card,
        price: null,
        marketPrices: card.form
          ? { ...(card.marketPrices || {}), [card.form]: null }
          : card.marketPrices,
      }
    : card;
  return unavailable && wasBroad ? { ...unavailable, pinned: false } : unavailable;
}

export function cardPriceLabel(card) {
  const price = cardPriceNumber(card?.price ?? card?.marketPrice);
  return price === null ? 'Exact price unavailable' : `$${price.toFixed(2)}`;
}

export function withCardRecord(result, fallback = null) {
  if (!result || typeof result !== 'object') return result;
  const card = cardRecordFromResult(result, fallback);
  if (!card) return result;
  const prices = { ...(result.prices || {}) };
  delete prices.trend_30d;
  prices.en_price = card.price === null ? '' : `$${card.price.toFixed(2)}`;
  prices.price_source = card.priceSource || '';
  prices.price_checked_at = card.priceCheckedAt || '';
  return {
    ...result,
    card,
    _pin: card,
    printing: card,
    card_name: card.name,
    game: card.game,
    prices,
  };
}

export function stampCardPrice(card, now = Date.now()) {
  const normalized = normalizeCardRecord(card);
  if (!normalized || normalized.price === null || normalized.priceCheckedAt) return normalized;
  return { ...normalized, priceCheckedAt: new Date(now).toISOString() };
}

export function cardPriceNeedsRefresh(card, now = Date.now()) {
  const checked = new Date(card?.priceCheckedAt || '').getTime();
  return !Number.isFinite(checked) || now - checked < 0 || now - checked > CARD_PRICE_TTL_MS;
}

export function applyCardPricePatch(card, patch) {
  const current = normalizeCardRecord(card || {});
  if (!current || !patch || !Object.prototype.hasOwnProperty.call(patch, 'en_price')) return current;
  const price = cardPriceNumber(patch.en_price);
  const marketPrices = current.form
    ? { ...(current.marketPrices || {}), [current.form]: price }
    : current.marketPrices;
  return normalizeCardRecord({
    ...current,
    price,
    marketPrices,
    priceSource: patch.price_source || null,
    priceCheckedAt: patch.price_checked_at || new Date().toISOString(),
  });
}
