import { collectionFormOptions, marketPriceFor } from './collection.js';

const GAME_LABELS = {
  pokemon: 'Pokémon',
  mtg: 'Magic',
  yugioh: 'Yu-Gi-Oh!',
};

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function scannerMatchDetails(match = {}) {
  const vision = match.card || {};
  const printing = match.pin || null;
  const source = printing || vision;
  const rawPrice = Number(source.price);

  return {
    exact: Boolean(printing),
    name: clean(source.name) || clean(vision.name) || 'Unknown card',
    game: source.game || vision.game || null,
    gameLabel: GAME_LABELS[source.game || vision.game] || 'Trading card',
    setName: clean(source.setName) || clean(source.set) || clean(vision.set) || 'Set unknown',
    number: clean(source.number) || clean(source.setCode) || clean(vision.number) || clean(vision.passcode) || null,
    rarity: clean(source.rarity) || null,
    finish: clean(source.finish) || null,
    form: source.form || 'normal',
    imageUrl: clean(source.imageUrl) || null,
    price: Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null,
    confidence: clean(vision.confidence) || null,
  };
}

export function scannerMatchMeta(details = {}) {
  return [details.setName, details.number, details.rarity, details.finish].filter(Boolean).join(' · ');
}

export function scannerMatchPrice(details = {}) {
  return Number.isFinite(details.price) && details.price > 0
    ? `$${details.price.toFixed(2)}`
    : 'Price unavailable';
}

export function scannerMatchDisplayPrice(details = {}, candidateCount = 0) {
  if (details.exact) return scannerMatchPrice(details);
  return candidateCount > 0 ? 'Choose below' : 'Not matched';
}

export function scannerPrintingKey(card = {}) {
  const identity = card.tcgplayerProductId || card.printingId || card.id
    || [card.name, card.setName, card.number].filter(Boolean).join(':');
  return [identity || 'unknown', card.form || 'normal', card.rarity || ''].join(':');
}

export function scannerBatchFormOptions(game, card = null) {
  return collectionFormOptions(game, card);
}

export function createScannerBatchEntry(match, id) {
  if (!match?.pin) return null;
  return {
    id: String(id),
    match,
    quantity: 1,
    condition: 'near_mint',
    form: match.pin.form || 'normal',
  };
}

export function scannerBatchSummary(entries) {
  const result = (Array.isArray(entries) ? entries : []).reduce((summary, entry) => {
    const qty = Math.max(1, Math.min(999, Math.floor(Number(entry?.quantity) || 1)));
    const price = Number(marketPriceFor(entry?.match?.pin, entry?.form));
    summary.cards += qty;
    if (Number.isFinite(price) && price > 0) summary.value += price * qty;
    else summary.unpriced += qty;
    return summary;
  }, { cards: 0, value: 0, unpriced: 0 });
  result.value = Math.round(result.value * 100) / 100;
  return result;
}
