// ─── Signal Type Definitions ─────────────────────────────────────────────────
// Colors: muted, sophisticated. No neon. No forest green.

export const SIGNAL_SECTIONS = [
  {
    id: 'japan',
    label: '⛩ Japan Market Intelligence',
    subtitle: 'Japanese sources and release facts',
    signals: ['jp_hype', 'jp_release'],
  },
  {
    id: 'short-term',
    label: 'SHORT-TERM SIGNALS',
    subtitle: 'Current market activity',
    signals: ['creator', 'community', 'ip_momentum', 'editorial'],
  },
  {
    id: 'structural',
    label: 'LONG-TERM SIGNALS',
    subtitle: 'Rules, printings and supply context',
    signals: ['competitive', 'scarcity'],
  },
];

export const SIGNAL_TYPES = {
  creator: {
    label: 'Creator Attention',
    color: '#B08060',
    description: 'Matching YouTube videos published in the last 7 days',
  },
  community: {
    label: 'Community Discussion',
    color: '#608870',
    description: 'Retrieved Reddit posts and web sources; a sample, not total mentions',
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
    description: 'Retrieved tournament evidence and current play rules',
  },
  scarcity: {
    label: 'Print Scarcity',
    color: '#907888',
    description: 'Retrieved supply evidence; catalogue entries are not print quantities',
  },
  jp_hype: {
    label: 'JP Community Buzz',
    color: '#B04848',
    description: 'Matching Japanese YouTube and web sources; no measured market lead',
  },
  jp_release: {
    label: 'JP Release Timeline',
    color: '#A05050',
    description: 'Verified Japanese release, reservation and restock context',
  },
};

export const SIGNAL_KEYS = Object.freeze(Object.keys(SIGNAL_TYPES));
export const SIGNAL_COUNT = SIGNAL_KEYS.length;
export const SCORE_VERSION = 3;

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
  if (!Number.isFinite(score)) return { label: 'UNRATED', color: '#80786C', blurb: 'There is not enough assessed evidence for a score.' };
  const safe = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Number(score))) : 50;
  if (safe >= 85) return { label: 'BLAZING', color: '#C44040', blurb: 'Broad, strong positive attention across the signals' };
  if (safe >= 70) return { label: 'SURGING', color: '#C44040', blurb: 'Clear positive attention across the evidence' };
  if (safe >= 56) return { label: 'HEATING', color: '#A09060', blurb: 'Attention leans positive' };
  if (safe >= 45) return { label: 'NEUTRAL', color: '#608870', blurb: 'Assessed evidence is neutral or mixed' };
  if (safe >= 30) return { label: 'COOLING', color: '#807060', blurb: 'Attention leans negative' };
  return                   { label: 'FALLING', color: '#7A7368', blurb: 'Broad negative attention across the signals' };
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
// Neutral and unrated context dilute a directional claim. Only an assessed
// source with a retrieved supporting excerpt can contribute up or down.
// −1 = all down, 0 = neutral/mixed, +1 = all up.
export function sourceDirection(sources) {
  const list = Array.isArray(sources) ? sources : [];
  let up = 0, down = 0;
  for (const s of list) {
    if (s?.directionAssessed === true && s?.implication === 'up') up++;
    else if (s?.directionAssessed === true && s?.implication === 'down') down++;
  }
  const counted = list.length;
  return counted === 0 ? 0 : (up - down) / counted;
}

// Convert direction to a bounded 0–1 factor for callers that need it.
// Bearish is 0, neutral/unsourced is 0.5, bullish is 1.
export function directionMultiplier(sources) {
  return (sourceDirection(sources) + 1) / 2;
}

// ─── Weighted Score Calculator ───────────────────────────────────────────────

// Score is attention with a direction, measured 2026-09-06 against real
// price history: it follows price rather than leading it, so it is labelled
// ATTENTION in the app until the forward test (2026-10-06) says otherwise.
//   0   = strong negative attention
//   50  = mixed, neutral, missing, or unsourced evidence
//   100 = strong positive attention
//
// Missing signals stay neutral and keep their configured weight. This prevents
// one returned 5/5 signal from becoming a perfect score on a truncated scan.
// Signal levels are clamped because model output is untrusted input.
export function calculateScoreDetails(signals, game) {
  const weights = WEIGHTS[game];
  if (!weights) return { score: null, assessedCount: 0, coveragePct: 0, evidencePct: 0, signalCount: 0 };

  const list = Array.isArray(signals) ? signals : [];
  const fullWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let weightedSum = 0;
  let presentWeight = 0;
  let evidenceWeight = 0;
  let signalCount = 0;
  let assessedCount = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const signal = list.find(s => s?.key === key);
    if (signal && Number.isFinite(signal.level)) {
      signalCount += 1;
      presentWeight += weight;
      const assessed = signal.strengthAssessed === true && signal.sources?.some(source => source.directionAssessed === true);
      if (assessed) assessedCount += 1;
      const level = assessed ? Math.max(0, Math.min(5, signal.level)) : 0;
      const direction = sourceDirection(signal.sources);
      const contribution = 0.5 + 0.5 * (level / 5) * direction;
      weightedSum += contribution * weight;
      if (Array.isArray(signal.sources) && signal.sources.length > 0) evidenceWeight += weight;
    } else {
      weightedSum += 0.5 * weight;
    }
  }

  if (fullWeight === 0) return { score: null, assessedCount: 0, coveragePct: 0, evidencePct: 0, signalCount: 0 };
  return {
    score: assessedCount ? Math.max(0, Math.min(100, Math.round((weightedSum / fullWeight) * 100))) : null,
    assessedCount,
    coveragePct: Math.round((presentWeight / fullWeight) * 100),
    evidencePct: Math.round((evidenceWeight / fullWeight) * 100),
    signalCount,
  };
}

export function calculateOverallScore(signals, game) {
  return calculateScoreDetails(signals, game).score;
}
