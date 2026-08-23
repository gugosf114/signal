// ─── Article title → card name candidates ────────────────────────────────────
// Last-resort art for a news tile whose source shipped no image. The title is
// all we have, so this pulls the most card-shaped phrases out of it and lets
// the caller try each against the real card APIs.
//
// Measured against 28 live headlines on 2026-08-23, this alone lands roughly
// one tile in six. That is the ceiling, not a tuning problem:
//
//   - YGOrganization reports cards BEFORE release, so the name in the headline
//     is genuinely absent from YGOPRODeck. "Headliner of Reigning" and
//     "Ultimate Demon's Dive" both 404 today and will resolve later.
//   - MTGGoldfish headlines are column names — "Single Scoop", "Much Abrew",
//     "Vintage 101" — and often contain no card at all.
//
// So this is the third choice behind a real source image, never the plan.

const QUOTED   = /[“"„]([^”"“]{2,60})[”"]/g;
const BRACKET  = /\[[^\]]{1,24}\]/g;
const SERIES   = /^[A-Za-z0-9 '\-]{2,28}(?:\s\d+)?:\s*/;
const TRAILING = /\b(?:in|of)\s+([A-Z][\w''\-]*(?:\s+[A-Z][\w''\-]*){0,3})\s*$/;

function tidy(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s–—\-:,.!?]+|[\s–—\-:,.!?]+$/g, '')
    .trim();
}

export function extractCardNames(title, game, limit = 2) {
  const out = [];
  const push = (value) => {
    const clean = tidy(value);
    if (!clean || clean.length < 3 || clean.length > 60) return;
    if (out.some((existing) => existing.toLowerCase() === clean.toLowerCase())) return;
    out.push(clean);
  };

  const raw = String(title || '');
  if (!raw) return out;

  // Quoted phrases are the single strongest signal — YGOrganization wraps
  // every card name it names in curly quotes.
  for (const match of raw.matchAll(QUOTED)) push(match[1]);

  const bare = tidy(raw.replace(BRACKET, ' ').split('|')[0]);

  const featured = bare.match(/\bft\.?\s+(.+)$/i);
  if (featured) {
    for (const part of featured[1].split(/\s+and\s+|,\s*/)) {
      push(part.replace(/\s+(?:Support|Deck|Cards?)\s*$/i, ''));
    }
  }

  if (game === 'pokemon') {
    const head = bare.split(/\s+Deck Guide\b/i)[0];
    if (head !== bare) for (const part of head.split('/')) push(part);
  }

  if (game === 'mtg') {
    const stripped = bare.replace(SERIES, '');
    const trailing = stripped.match(TRAILING);
    if (trailing) push(trailing[1]);
    if (stripped !== bare) push(stripped);
  }

  return out.slice(0, limit);
}
