// ─── Signal Type Definitions ─────────────────────────────────────────────────
// Colors: muted, sophisticated. No neon. No forest green.

export const SIGNAL_SECTIONS = [
  {
    id: 'japan',
    label: '⛩ Japan Market Intelligence',
    subtitle: 'Leading indicators from the JP market',
    signals: ['jp_price', 'jp_hype', 'jp_release'],
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
  jp_price: {
    label: 'JP Price Signal',
    color: '#C44040',
    description: 'Japanese market price vs English, JP–EN gap',
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
    jp_price: 0.12,
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
    jp_price: 0.12,
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
    jp_price: 0.08,
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

// JP-match downweight: when jp_price is comparing a DIFFERENT printing of the
// same character (not the same card), the comp is loose and shouldn't carry
// its full nominal weight. Apply 60% of the normal weight in that case.
const JP_COMP_WEIGHT_MULTIPLIER = 0.6;

export function calculateOverallScore(signals, game) {
  const weights = WEIGHTS[game];
  if (!weights) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, baseWeight] of Object.entries(weights)) {
    const signal = signals.find(s => s.key === key);
    if (signal && typeof signal.level === 'number') {
      let weight = baseWeight;
      // jp_price loses 40% of its weight when the comp is a different
      // printing — fuzzy comps shouldn't get full say. Absent flag = treat
      // as exact (safer default for legacy cached scans).
      if (key === 'jp_price' && signal.jp_match === 'comp') {
        weight = baseWeight * JP_COMP_WEIGHT_MULTIPLIER;
      }
      weightedSum += (signal.level / 5) * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}
