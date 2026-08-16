// ─── Backfill for scans made before the printing line existed ────────────────
// Cached scans live for 7 days, so every card already on the shelf carries no
// printing and would show no identifier until it aged out or was paid for
// again. This asks the free catalogue what printing that scan was about — no
// Anthropic call, no cost — and patches the cached entry in place.

import { fetchCardData } from './fetchCardData';
import { toPrinting } from './printing';

export async function backfillPrinting(cardName, game, pin = null) {
  try {
    const data = await fetchCardData(cardName, game, pin);
    if (!data) return null;
    return toPrinting(game || data.game, pin, data);
  } catch {
    return null;
  }
}
