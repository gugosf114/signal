export function pendingScanCard(name, game, pin = null) {
  return {
    name: String(name || '').trim(),
    game: game || pin?.game || null,
    pin: pin || null,
  };
}

export function pendingPrintingId(card) {
  return card?.pin?.printingId || card?.pin?.id || null;
}
