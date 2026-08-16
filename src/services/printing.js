// ─── The line under the card name ────────────────────────────────────────────
// "Charizard" is hundreds of cards. The identifier printed on the card is what
// separates the $5 one from the $500 one, so it goes under the name everywhere
// the name appears: the result page and the exported report.
//
// Each game stamps its cards differently, and the label follows what is
// actually printed:
//   Pokémon   Prismatic Evolutions · 161/131 · Special Illustration Rare
//   MTG       Limited Edition Alpha · LEA 233 · rare
//   Yu-Gi-Oh  Legend of Blue Eyes White Dragon · LOB-EN005 · Ultra Rare
//
// No import-free rule here beyond keeping it pure — this is called from render.

export function printingLabel(printing) {
  if (!printing) return null;
  const { game, setName, setId, number, printedTotal, rarity } = printing;

  let id = null;
  if (game === 'pokemon' && number) {
    id = printedTotal ? `${number}/${printedTotal}` : String(number);
  } else if (game === 'mtg' && number) {
    // The set code is the half people quote; without it a collector number is
    // ambiguous across twenty years of sets.
    id = setId ? `${String(setId).toUpperCase()} ${number}` : String(number);
  } else if (number) {
    // Yu-Gi-Oh already carries its set inside the code.
    id = String(number);
  } else if (setId) {
    id = String(setId).toUpperCase();
  }

  const parts = [];
  if (setName && setName !== id) parts.push(setName);
  if (id) parts.push(id);
  if (rarity) parts.push(rarity);
  return parts.length ? parts.join(' · ') : null;
}

// Normalizes whatever we know about a printing into one shape. `pin` is a card
// the user chose; `cardData` is the free-API pre-fetch.
export function toPrinting(game, pin, cardData) {
  const src = cardData || {};
  const out = {
    game: game || src.game || pin?.game || null,
    setName: pin?.setName || src.setName || null,
    setId: pin?.setId || src.setId || null,
    number: pin?.number || src.number || null,
    printedTotal: src.printedTotal || null,
    rarity: src.rarity || null,
    pinned: !!pin,
  };
  return out.setName || out.number || out.setId ? out : null;
}
