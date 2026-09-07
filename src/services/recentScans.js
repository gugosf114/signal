import { printingLabel } from './printing.js';
import { normalizeCardRecord } from './cardRecord.js';

export function hasPrintingPin(pin) {
  if (!pin) return false;
  // `pinned:false` marks an old report where a broad name lookup silently
  // chose one printing. That is the exact bad state this gate must reject.
  if (pin.pinned === false) return false;
  // YGOPRODeck's numeric `id` names the card across every reprint. Only the
  // printingId carries the set code. Pokémon and Scryfall IDs are print-level.
  if (pin.game === 'yugioh') return Boolean(pin.printingId);
  if (pin.game === 'pokemon' || pin.game === 'mtg') {
    return Boolean((pin.printingId || pin.id) && pin.form);
  }
  return false;
}

export function isSafeRecentScan(item) {
  if (!item?.name) return false;
  return hasPrintingPin(item.pin)
    && Boolean(item.pin?.name)
    && Boolean(item.pin?.setName)
    && Boolean(item.pin?.number);
}

export function sanitizeRecentScans(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const pin = normalizeCardRecord(item?.pin || {}, {
      name: item?.name,
      game: item?.game,
      price: item?.enPrice,
    });
    return pin ? { ...item, name: pin.name, game: pin.game, pin } : null;
  }).filter(isSafeRecentScan);
}

export function recentPrintingLine(item) {
  if (!hasPrintingPin(item?.pin)) return null;
  return printingLabel(item.pin)
    || item.pin.setCode
    || item.pin.printingId
    || item.pin.id;
}
