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

export const SIGNAL_KEYS = Object.freeze(Object.keys(SIGNAL_TYPES));
export const SIGNAL_COUNT = SIGNAL_KEYS.length;
export const SCORE_VERSION = 2;

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
  const safe = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : 50;
  if (safe >= 85) return { label: 'BLAZING', color: '#C44040', blurb: 'Broad upward pressure across strong signals' };
  if (safe >= 70) return { label: 'SURGING', color: '#C44040', blurb: 'Clear upward pressure across the evidence' };
  if (safe >= 56) return { label: 'HEATING', color: '#A09060', blurb: 'The evidence leans upward' };
  if (safe >= 45) return { label: 'STEADY',  color: '#608870', blurb: 'The evidence is mixed or neutral' };
  if (safe >= 30) return { label: 'COOLING', color: '#807060', blurb: 'The evidence leans downward' };
  return                   { label: 'FALLING', color: '#7A7368', blurb: 'Broad downward pressure across strong signals' };
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

// Convert direction to a bounded 0–1 factor for callers that need it.
// Bearish is 0, neutral/unsourced is 0.5, bullish is 1.
export function directionMultiplier(sources) {
  return (sourceDirection(sources) + 1) / 2;
}

// ─── Weighted Score Calculator ───────────────────────────────────────────────

// Score is market pressure, not raw attention:
//   0   = strong bearish pressure
//   50  = mixed, neutral, missing, or unsourced evidence
//   100 = strong bullish pressure
//
// Missing signals stay neutral and keep their configured weight. This prevents
// one returned 5/5 signal from becoming a perfect score on a truncated scan.
// Signal levels are clamped because model output is untrusted input.
export function calculateScoreDetails(signals, game) {
  const weights = WEIGHTS[game];
  if (!weights) return { score: 0, coveragePct: 0, evidencePct: 0, signalCount: 0 };

  const list = Array.isArray(signals) ? signals : [];
  const fullWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let weightedSum = 0;
  let presentWeight = 0;
  let evidenceWeight = 0;
  let signalCount = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const signal = list.find(s => s?.key === key);
    if (signal && typeof signal.level === 'number') {
      signalCount += 1;
      presentWeight += weight;
      const level = Math.max(0, Math.min(5, signal.level));
      const direction = sourceDirection(signal.sources);
      const contribution = 0.5 + 0.5 * (level / 5) * direction;
      weightedSum += contribution * weight;
      if (Array.isArray(signal.sources) && signal.sources.length > 0) evidenceWeight += weight;
    } else {
      weightedSum += 0.5 * weight;
    }
  }

  if (fullWeight === 0) return { score: 0, coveragePct: 0, evidencePct: 0, signalCount: 0 };
  return {
    score: Math.max(0, Math.min(100, Math.round((weightedSum / fullWeight) * 100))),
    coveragePct: Math.round((presentWeight / fullWeight) * 100),
    evidencePct: Math.round((evidenceWeight / fullWeight) * 100),
    signalCount,
  };
}

export function calculateOverallScore(signals, game) {
  return calculateScoreDetails(signals, game).score;
}
