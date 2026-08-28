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
    number: clean(source.number) || clean(source.setCode) || clean(vision.number) || null,
    rarity: clean(source.rarity) || null,
    imageUrl: clean(source.imageUrl) || null,
    price: Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : null,
    confidence: clean(vision.confidence) || null,
  };
}

export function scannerMatchMeta(details = {}) {
  return [details.setName, details.number, details.rarity].filter(Boolean).join(' · ');
}

export function scannerMatchPrice(details = {}) {
  return Number.isFinite(details.price) && details.price > 0
    ? `$${details.price.toFixed(2)}`
    : 'Price unavailable';
}
