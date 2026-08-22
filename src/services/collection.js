// ─── The collection ──────────────────────────────────────────────────────────
// A list of cards you own. Not a portfolio: no prices, no totals, no valuation.
// The point is to have the shelf somewhere you can show it to someone.
//
// Stored in localStorage like the rest of this app's state. One entry per
// printing — the $1,499 Umbreon ex and the $7 one are two different cards and
// two different rows, which is the same rule the scan cache follows.

const KEY = 'signal_collection_v1';
const MAX_ENTRIES = 2000;
const MAX_QTY = 999;

function cleanQty(value) {
  const qty = Number(value);
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(MAX_QTY, Math.floor(qty)));
}

// Identity is the catalogue id, because that is what makes a printing a
// printing. Cards added before an id was available fall back to name + set,
// which is coarser but never merges two different names.
export function cardKey(card) {
  if (!card) return '';
  const game = (card.game || 'unknown').toLowerCase();
  const printingId = card.printingId || card.id;
  if (printingId) return `${game}::${String(printingId).toLowerCase()}`;
  const name = String(card.name || '').trim().toLowerCase();
  const set = String(card.setName || '').trim().toLowerCase();
  const num = String(card.number || '').trim().toLowerCase();
  return `${game}::${name}::${set}::${num}`;
}

export function loadCollection() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((card) => card && card.name).map((card) => ({ ...card, qty: cleanQty(card.qty) }))
      : [];
  } catch {
    return [];
  }
}

function save(list) {
  const trimmed = list.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or disabled. Nothing useful to do here — the in-memory list
    // the caller already holds stays correct for this session.
  }
  return trimmed;
}

// Adding a card you already own bumps its count rather than growing a second
// row: three copies of the same printing is a fact about the card, not three
// cards. Returns the new list.
export function addToCollection(card, at) {
  if (!card || !card.name) return loadCollection();
  const list = loadCollection();
  const key = cardKey(card);
  const existing = list.findIndex((c) => cardKey(c) === key);
  const stamp = at || new Date().toISOString();

  if (existing >= 0) {
    const next = [...list];
    next[existing] = { ...next[existing], qty: Math.min(MAX_QTY, cleanQty(next[existing].qty) + 1), addedAt: stamp };
    // Bumping a count moves the card to the front, same as adding a new one —
    // the thing you just touched is the thing you're looking at.
    const [moved] = next.splice(existing, 1);
    return save([moved, ...next]);
  }

  const entry = {
    id: card.id || null,
    printingId: card.printingId || card.id || null,
    game: card.game || null,
    name: card.name,
    setName: card.setName || null,
    number: card.number || null,
    imageUrl: card.imageUrl || null,
    imageLarge: card.imageLarge || card.imageUrl || null,
    qty: 1,
    addedAt: stamp,
  };
  return save([entry, ...list]);
}

// Removing takes one copy off. The row disappears when the last one goes.
export function removeOne(card) {
  const list = loadCollection();
  const key = cardKey(card);
  const i = list.findIndex((c) => cardKey(c) === key);
  if (i < 0) return list;
  const next = [...list];
  const qty = cleanQty(next[i].qty) - 1;
  if (qty <= 0) next.splice(i, 1);
  else next[i] = { ...next[i], qty };
  return save(next);
}

// Removing the whole row, however many copies.
export function removeAll(card) {
  const key = cardKey(card);
  return save(loadCollection().filter((c) => cardKey(c) !== key));
}

// Total cards held, counting duplicates — "48 cards", not "31 rows".
export function countCards(list) {
  return (Array.isArray(list) ? list : []).reduce((n, c) => n + cleanQty(c?.qty), 0);
}
