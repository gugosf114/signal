// ─── Signal Type Definitions ─────────────────────────────────────────────────
// Colors: muted, sophisticated. No neon. No forest green.

export const SIGNAL_SECTIONS = [
  {
    id: 'japan',
    label: '⛩ Japan Market Intelligence',
    subtitle: 'Leading indicators from the JP market',
    signals: ['jp_hype', 'jp_release'],
  },
  {
    id: 'short-term',
    label: 'SHORT-TERM SIGNALS',
    subtitle: '1–30 days',
    signals: ['creator', 'community', 'ip_momentum', 'editorial'],
  },
  {
    id: 'structural',
    label: 'LONG-TERM SIGNALS',
    subtitle: '3–12 months',
    signals: ['competitive', 'scarcity'],
  },
];

export const SIGNAL_TYPES = {
  creator: {
    label: 'Creator Attention',
    color: '#B08060',
    description: 'YouTube/TikTok videos mentioning this card in last 7 days',
  },
  community: {
    label: 'Community Volume',
    color: '#608870',
    description: 'Reddit posts, TikTok mentions, X/Twitter activity',
  },
  ip_momentum: {
    label: 'Franchise Buzz',
    color: '#A09060',
    description: 'Anime series, movie releases, new game launches — franchise-level hype',
  },
  editorial: {
    label: 'Editorial Attention',
    color: '#708880',
    description: 'TCG news articles, set reviews, "top cards" lists',
  },
  competitive: {
    label: 'Competitive Demand',
    color: '#7080A0',
    description: 'Tournament top 8 appearances, ban list status',
  },
  scarcity: {
    label: 'Print Scarcity',
    color: '#907888',
    description: 'Print run size, PSA population, out of print status',
  },
  jp_hype: {
    label: 'JP Community Buzz',
    color: '#B04848',
    description: 'Japanese Twitter/X, YouTube, Mercari JP trending',
  },
  jp_release: {
    label: 'JP Release Timeline',
    color: '#A05050',
    description: 'JP set released before EN, time advantage window',
  },
};

// ─── Per-Game Weights ────────────────────────────────────────────────────────
// Each game has different market dynamics that determine which signals matter most.

export const WEIGHTS = {
  'yugioh': {
    competitive: 0.24,
    scarcity: 0.20,
    creator: 0.15,
    community: 0.09,
    jp_hype: 0.08,
    editorial: 0.07,
    jp_release: 0.03,
    ip_momentum: 0.02,
  },
  'pokemon': {
    creator: 0.22,
    scarcity: 0.20,
    ip_momentum: 0.12,
    jp_hype: 0.09,
    community: 0.09,
    editorial: 0.07,
    jp_release: 0.05,
    competitive: 0.04,
  },
  'mtg': {
    competitive: 0.27,
    scarcity: 0.22,
    creator: 0.16,
    community: 0.11,
    editorial: 0.08,
    ip_momentum: 0.03,
    jp_hype: 0.03,
    jp_release: 0.02,
  },
};

// ─── Sample Cards (Quick Picks) ──────────────────────────────────────────────

// Fallback chips only — QuickPicks replaces these with live movers from
// getTopTrending() as soon as that resolves. Nothing renders `set`, so the
// three entries that carried an unverified TODO_VERIFY set name have simply
// had it removed rather than shipping a guess as data.
export const SAMPLE_CARDS = [
  // Present-tense reseller targets — confirmed real sets
  { name: 'Umbreon ex', set: 'Stellar Crown', game: 'pokemon' },
  { name: 'Dragapult ex', set: 'Twilight Masquerade', game: 'pokemon' },
  { name: 'Charizard ex', set: 'SV 151', game: 'pokemon' },
  { name: 'Mega Dragonite ex', game: 'pokemon' },
  { name: 'Mega Zygarde ex', game: 'pokemon' },
  { name: 'Mega Charizard X ex', game: 'pokemon' },
  // Yu-Gi-Oh!
  { name: 'Fiendsmith Lurgia', set: 'Legacy of Destruction', game: 'yugioh' },
];

// ─── Game Display Labels ─────────────────────────────────────────────────────

export const GAME_LABELS = {
  pokemon: { label: 'Pokémon', color: '#A09060' },
  yugioh: { label: 'Yu-Gi-Oh!', color: '#7080A0' },
  mtg: { label: 'Magic: The Gathering', color: '#B08060' },
};

// ─── Score Thresholds ────────────────────────────────────────────────────────

// Label + collector-language blurb per tier. Descriptive, not directive —
// kept out of "buy / sell / hold" territory so the score reads as a status
// not a recommendation. Pairs with the "Not financial advice" footer.
export function getScoreLabel(score) {
  if (score >= 85) return { label: 'BLAZING', color: '#C44040', blurb: 'At its peak — chase-card energy right now' };
  if (score >= 70) return { label: 'SURGING', color: '#C44040', blurb: 'Real upward pressure — momentum is stacking' };
  if (score >= 50) return { label: 'HEATING', color: '#A09060', blurb: 'Interest is building — the card keeps coming up' };
  if (score >= 30) return { label: 'STEADY',  color: '#608870', blurb: 'Fair market — settled, fundamentals intact' };
  if (score >= 15) return { label: 'COOLING', color: '#807060', blurb: 'Losing momentum — moving slower than peers' };
  return                  { label: 'DORMANT', color: '#7A7368', blurb: 'Quiet right now — sleeping in the binder' };
}

// ─── Weighted Score Calculator ───────────────────────────────────────────────

// ─── Direction ───────────────────────────────────────────────────────────────
// Every cited source carries an `implication` — up, down, or neutral — and the
// UI has always drawn it as a ▲▼ arrow. The score ignored it completely: a
// signal contributed on `level` alone, which measures how MUCH is being said,
// never WHICH WAY.
//
// That produced a real miss. Umbreon ex scored 77 (SURGING, "real upward
// pressure") off huge community volume — volume driven by backlash over
// scalping. Its own summary read "strong bearish signals"; the price then fell.
// The score could not tell excitement from a riot.
//
// A signal whose sources lean bearish now contributes less. Halved at fully
// bearish rather than zeroed: the level still says real attention is being paid,
// and attention on the way down is not worth nothing. Sources with no stated
// implication, and signals with no surviving sources at all, are left at full
// contribution — deliberately out of scope for this change so the before/after
// comparison isolates direction alone.
const MAX_BEARISH_PENALTY = 0.5;

// −1 (every source bearish) … 0 (balanced / neutral / unsourced) … +1 (all bullish)
export function sourceDirection(sources) {
  const list = Array.isArray(sources) ? sources : [];
  let up = 0, down = 0;
  for (const s of list) {
    if (s?.implication === 'up') up++;
    else if (s?.implication === 'down') down++;
  }
  const counted = up + down;
  return counted === 0 ? 0 : (up - down) / counted;
}

// Bullish and neutral are unpenalised; only bearish evidence damps the signal.
export function directionMultiplier(sources) {
  const net = sourceDirection(sources);
  return net >= 0 ? 1 : 1 + net * MAX_BEARISH_PENALTY;
}

// ─── Weighted Score Calculator ───────────────────────────────────────────────

// Only signals actually present in the response contribute, and the divisor is
// the weight of those signals alone — so a scan missing a signal re-shares its
// weight across the rest rather than being silently penalised. (This is also
// what let the jp_price signal be removed without re-tuning every other weight.)
export function calculateOverallScore(signals, game) {
  const weights = WEIGHTS[game];
  if (!weights) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const signal = signals.find(s => s.key === key);
    if (signal && typeof signal.level === 'number') {
      const contribution = (signal.level / 5) * directionMultiplier(signal.sources);
      weightedSum += contribution * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}
