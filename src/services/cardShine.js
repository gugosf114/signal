// A visual preview for a known foil finish whose photo is shared or generic.
// This never chooses a finish, changes a price, or claims a physical pattern.
export function cardShinePreview(card) {
  if (!card || ['scan', 'owner-scan'].includes(card.imageSource)) return null;
  const form = card.form;
  if (card.game === 'mtg' && ['foil', 'etched'].includes(form)) {
    const shared = card.imageSharedFinishes?.length > 1;
    return shared || card.imageSource !== 'tcgplayer' ? (form === 'etched' ? 'etched' : 'foil') : null;
  }
  if (card.game === 'pokemon' && ['holo', 'reverse', 'first_edition_holo', 'unlimited_holo'].includes(form)) {
    if (card.pokemonImageShared === false) return null;
    return card.pokemonImageShared || card.imageSource !== 'tcgplayer' ? 'foil' : null;
  }
  return null;
}
