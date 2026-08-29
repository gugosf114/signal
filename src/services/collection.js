// ─── The collection ──────────────────────────────────────────────────────────
// The catalogue supplies the clean card image and market price. The user adds
// only the facts that belong to their copy: quantity, condition, form, and an
// optional amount paid.

const KEY = 'signal_collection_v1';
const MAX_ENTRIES = 2000;
const MAX_QTY = 999;
const CONDITIONS = new Set(['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']);
const FORM_LABELS = {
  pokemon: {
    normal: 'Normal', holo: 'Holo', reverse: 'Reverse Holo',
    first_edition_normal: '1st Edition Normal', first_edition_holo: '1st Edition Holo',
    unlimited_normal: 'Unlimited Normal', unlimited_holo: 'Unlimited Holo',
  },
  mtg: { normal: 'Non-foil', foil: 'Foil', etched: 'Etched' },
  yugioh: { normal: '' },
};

function cleanQty(value) {
  const qty = Number(value);
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(MAX_QTY, Math.floor(qty)));
}

function cleanMoney(value) {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

function cleanCondition(value) {
  return CONDITIONS.has(value) ? value : 'near_mint';
}

function cleanFormForGame(game, value) {
  const key = String(game || '').toLowerCase();
  const migrated = key === 'mtg' && value === 'reverse' ? 'foil' : String(value || 'normal');
  return Object.prototype.hasOwnProperty.call(FORM_LABELS[key] || {}, migrated) ? migrated : 'normal';
}

function cleanCatalogueImage(value) {
  const image = typeof value === 'string' ? value.trim() : '';
  if (!image) return null;
  // Uploaded/scanned photos are private working files, not collection art.
  // Capacitor serves them through a localhost _capacitor_file_ URL. Old
  // builds also stored blob/data/file URLs. Reject every local form while
  // keeping catalogue URLs and older relative test/import values intact.
  if (/^(?:blob:|data:|file:|capacitor:)/i.test(image) || /\/_capacitor_file_\//i.test(image)) return null;
  return image;
}

export function formatCollectionMoney(value) {
  const amount = cleanMoney(value);
  return amount === null ? '—' : `$${amount.toFixed(2)}`;
}

export function collectionFormOptions(game, card = null) {
  const key = String(game || '').toLowerCase();
  if (key === 'yugioh') return [];
  const labels = FORM_LABELS[key] || FORM_LABELS.pokemon;
  const listed = Array.isArray(card?.availableFinishes)
    ? card.availableFinishes
    : Object.keys(card?.marketPrices || {});
  const defaults = key === 'mtg' ? ['normal', 'foil'] : ['normal', 'reverse'];
  const forms = [...new Set((listed.length ? listed : defaults)
    .map((form) => cleanFormForGame(key, form))
    .filter((form) => Object.prototype.hasOwnProperty.call(labels, form)))];
  return forms.map((value) => ({ value, label: labels[value] }));
}

export function collectionFormLabel(game, form) {
  const key = String(game || '').toLowerCase();
  return FORM_LABELS[key]?.[cleanFormForGame(key, form)] || '';
}

function baseCardKey(card) {
  if (!card) return '';
  const game = (card.game || 'unknown').toLowerCase();
  const printingId = card.printingId || card.id;
  if (printingId) return `${game}::${String(printingId).toLowerCase()}`;
  const name = String(card.name || '').trim().toLowerCase();
  const set = String(card.setName || '').trim().toLowerCase();
  const num = String(card.number || '').trim().toLowerCase();
  return `${game}::${name}::${set}::${num}`;
}

// The same catalogue card in two conditions or forms stays as two holdings.
// This does not change lookup. It only keeps the user's own notes apart.
export function cardKey(card) {
  return `${baseCardKey(card)}::${cleanFormForGame(card?.game, card?.form)}::${cleanCondition(card?.condition)}`;
}

export function marketPriceFor(card, form = card?.form) {
  const selectedForm = cleanFormForGame(card?.game, form);
  const variants = card?.marketPrices && typeof card.marketPrices === 'object'
    ? card.marketPrices
    : {};
  const picked = variants[selectedForm];
  const cardForm = cleanFormForGame(card?.game, card?.form);
  const rowPrice = selectedForm === cardForm ? (card?.marketPrice ?? card?.price) : null;
  return cleanMoney(picked ?? rowPrice);
}

function normalizeEntry(card) {
  if (!card || !card.name) return null;
  const qty = cleanQty(card.qty);
  const paidPerCard = cleanMoney(card.paidPerCard);
  const smallImage = cleanCatalogueImage(card.imageUrl);
  const largeImage = cleanCatalogueImage(card.imageLarge);
  const tcgplayerImageUrl = cleanCatalogueImage(card.tcgplayerImageUrl);
  const rawProductId = Number(card.tcgplayerProductId);
  const tcgplayerProductId = Number.isInteger(rawProductId) && rawProductId > 0 ? rawProductId : null;
  const imageSource = (smallImage || largeImage)
    && ['tcgplayer', 'exact-catalogue'].includes(card.imageSource)
    ? card.imageSource
    : null;
  return {
    id: card.id || null,
    printingId: card.printingId || card.id || null,
    game: card.game || null,
    name: String(card.name).trim(),
    setName: card.setName || null,
    setId: card.setId || null,
    number: card.number || null,
    rarity: card.rarity || null,
    finish: card.finish || null,
    availableFinishes: Array.isArray(card.availableFinishes) ? [...card.availableFinishes] : null,
    scanImagePath: null,
    imageUrl: smallImage || largeImage,
    imageLarge: largeImage || smallImage,
    imageSource,
    tcgplayerProductId,
    tcgplayerImageUrl,
    form: cleanFormForGame(card.game, card.form),
    condition: cleanCondition(card.condition),
    qty,
    marketPrice: marketPriceFor(card),
    marketPrices: card.marketPrices && typeof card.marketPrices === 'object'
      ? Object.fromEntries(Object.entries(card.marketPrices)
        .filter(([form]) => Object.prototype.hasOwnProperty.call(FORM_LABELS[card.game] || {}, cleanFormForGame(card.game, form)))
        .map(([form, value]) => [cleanFormForGame(card.game, form), cleanMoney(value)]))
      : null,
    paidPerCard,
    paidKnownQty: paidPerCard === null ? 0 : Math.max(1, Math.min(qty, cleanQty(card.paidKnownQty || qty))),
    addedAt: card.addedAt || new Date().toISOString(),
  };
}

export function loadCollection() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveCollection(list) {
  const clean = (Array.isArray(list) ? list : []).map(normalizeEntry).filter(Boolean).slice(0, MAX_ENTRIES);
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch {}
  return clean;
}

function mergeEntry(list, entry) {
  const candidate = normalizeEntry(entry);
  if (!candidate) return list;
  const index = list.findIndex((item) => cardKey(item) === cardKey(candidate));
  if (index < 0) return [candidate, ...list].slice(0, MAX_ENTRIES);

  const prior = normalizeEntry(list[index]);
  const nextQty = Math.min(MAX_QTY, prior.qty + candidate.qty);
  const priorKnown = Math.min(prior.qty, Number(prior.paidKnownQty) || 0);
  const addedKnown = Math.min(candidate.qty, Number(candidate.paidKnownQty) || 0);
  const knownQty = priorKnown + addedKnown;
  const paidTotal = (prior.paidPerCard || 0) * priorKnown
    + (candidate.paidPerCard || 0) * addedKnown;
  const merged = {
    ...prior,
    ...candidate,
    qty: nextQty,
    paidKnownQty: Math.min(nextQty, knownQty),
    paidPerCard: knownQty ? Math.round((paidTotal / knownQty) * 100) / 100 : null,
    marketPrice: candidate.marketPrice ?? prior.marketPrice,
    addedAt: candidate.addedAt,
  };
  const next = [...list];
  next.splice(index, 1);
  return [merged, ...next].slice(0, MAX_ENTRIES);
}

export function addToCollection(card, details = {}, at = null) {
  // Backward compatibility for the old addToCollection(card, timestamp) call.
  if (typeof details === 'string') {
    at = details;
    details = {};
  }
  if (!card || !card.name) return loadCollection();
  const form = cleanFormForGame(card.game, details.form);
  const quantity = cleanQty(details.quantity);
  const paidPerCard = cleanMoney(details.paidPerCard);
  const entry = {
    ...card,
    form,
    condition: cleanCondition(details.condition),
    qty: quantity,
    marketPrice: marketPriceFor(card, form),
    paidPerCard,
    paidKnownQty: paidPerCard === null ? 0 : quantity,
    addedAt: at || new Date().toISOString(),
  };
  return saveCollection(mergeEntry(loadCollection(), entry));
}

export function importCollection(entries) {
  let merged = loadCollection();
  for (const entry of Array.isArray(entries) ? entries : []) merged = mergeEntry(merged, entry);
  return saveCollection(merged);
}

export function removeOne(card) {
  const list = loadCollection();
  const key = cardKey(card);
  const index = list.findIndex((item) => cardKey(item) === key);
  if (index < 0) return list;
  const next = [...list];
  const qty = next[index].qty - 1;
  if (qty <= 0) next.splice(index, 1);
  else next[index] = { ...next[index], qty, paidKnownQty: Math.min(qty, next[index].paidKnownQty || 0) };
  return saveCollection(next);
}

export function addOne(card, at = null) {
  const list = loadCollection();
  const key = cardKey(card);
  const index = list.findIndex((item) => cardKey(item) === key);
  if (index < 0) return list;
  const current = normalizeEntry(list[index]);
  const added = {
    ...current,
    qty: Math.min(MAX_QTY, current.qty + 1),
    addedAt: at || new Date().toISOString(),
  };
  const next = [...list];
  next.splice(index, 1);
  return saveCollection([added, ...next]);
}

export function removeAll(card) {
  const key = cardKey(card);
  return saveCollection(loadCollection().filter((item) => cardKey(item) !== key));
}

export function countCards(list) {
  return (Array.isArray(list) ? list : []).reduce((total, card) => total + cleanQty(card?.qty), 0);
}

export function collectionValue(list) {
  return collectionValueSummary(list).total;
}

export function collectionValueSummary(list) {
  const summary = (Array.isArray(list) ? list : []).reduce((result, card) => {
    const qty = cleanQty(card?.qty);
    const price = cleanMoney(card?.marketPrice);
    if (price === null) result.unpricedQty += qty;
    else {
      result.total += price * qty;
      result.pricedQty += qty;
    }
    return result;
  }, { total: 0, pricedQty: 0, unpricedQty: 0 });
  summary.total = Math.round(summary.total * 100) / 100;
  return summary;
}

function addedTime(card) {
  const value = Date.parse(card?.addedAt || '');
  return Number.isFinite(value) ? value : 0;
}

// One collection, four views: every card together or one game's binder.
// Sorting returns a copy so changing the view never rewrites the saved order.
export function collectionView(list, binder = 'all', sort = 'newest') {
  const cards = Array.isArray(list) ? list : [];
  const game = String(binder || 'all').toLowerCase();
  const visible = game === 'all'
    ? [...cards]
    : cards.filter((card) => String(card?.game || '').toLowerCase() === game);

  return visible.sort((a, b) => {
    if (sort === 'oldest') return addedTime(a) - addedTime(b) || String(a?.name || '').localeCompare(String(b?.name || ''));
    if (sort === 'price_high' || sort === 'price_low') {
      const aPrice = cleanMoney(a?.marketPrice);
      const bPrice = cleanMoney(b?.marketPrice);
      if (aPrice === null && bPrice !== null) return 1;
      if (aPrice !== null && bPrice === null) return -1;
      if (aPrice !== null && bPrice !== null && aPrice !== bPrice) {
        return sort === 'price_high' ? bPrice - aPrice : aPrice - bPrice;
      }
    }
    return addedTime(b) - addedTime(a) || String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}
