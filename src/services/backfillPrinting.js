// ─── Backfill for scans made before the printing line existed ────────────────
// Only a saved pin can recover a printing. A name alone cannot tell which old
// printing was scanned, so this helper refuses to turn today's first name match
// into a historical fact.

import { fetchCardData } from './fetchCardData';
import { toPrinting } from './printing';

export async function backfillPrinting(cardName, game, pin = null) {
  if (!pin?.id) return null;
  try {
    const data = await fetchCardData(cardName, game, pin);
    if (!data) return null;
    return toPrinting(game || data.game, pin, data);
  } catch {
    return null;
  }
}
