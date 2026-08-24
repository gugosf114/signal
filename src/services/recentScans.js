import { printingLabel } from './printing.js';

// These words claim one physical version, not merely one card name. Without a
// catalogue pin, Signal cannot prove which object they mean and must not turn
// the label into a broad name scan.
const PRINTING_WORDS = /\b(?:alternate art|starlight rare|quarter century|qcr|special illustration rare|illustration rare|secret rare|serialized|borderless|showcase|first edition|1st edition|reverse holo|holofoil)\b/i;

export function hasPrintingPin(pin) {
  if (!pin) return false;
  // YGOPRODeck's numeric `id` names the card across every reprint. Only the
  // printingId carries the set code. Pokémon and Scryfall IDs are print-level.
  if (pin.game === 'yugioh') return Boolean(pin.printingId);
  return Boolean(pin.printingId || pin.id);
}

export function nameClaimsExactPrinting(name) {
  return PRINTING_WORDS.test(String(name || ''));
}

export function isSafeRecentScan(item) {
  if (!item?.name) return false;
  return hasPrintingPin(item.pin) || !nameClaimsExactPrinting(item.name);
}

export function sanitizeRecentScans(items) {
  return (Array.isArray(items) ? items : []).filter(isSafeRecentScan);
}

export function recentPrintingLine(item) {
  if (!hasPrintingPin(item?.pin)) return null;
  return printingLabel(item.pin)
    || item.pin.setCode
    || item.pin.printingId
    || item.pin.id;
}
