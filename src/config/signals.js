// ─── Signal Type Definitions ─────────────────────────────────────────────────
// Each signal has a unique key, display metadata, and per-game weight.
// Weights within each game sum to 1.0.

export const SIGNAL_SECTIONS = [
  {
    id: 'short-term',
    label: 'SHORT-TERM SIGNALS',
    subtitle: '1–30 days',
    signals: ['creator', 'community', 'ip_momentum', 'editorial'],
  },
  {
    id: 'structural',
    label: 'STRUCTURAL SIGNALS',
    subtitle: '3–12 months',
    signals: ['competitive', 'scarcity'],
  },
  {
    id: 'japan',
    label: '⛩ JAPAN MARKET INTELLIGENCE',
    subtitle: 'Leading indicators from the JP market',
    signals: ['jp_price', 'jp_hype', 'jp_release'],
  },
];

export const SIGNAL_TYPES = {
  creator: {
    key: 'creator',
    label: 'Creator Attention',
    icon: '📹',
    color: '#FF6B6B',
    description: 'YouTube/TikTok videos mentioning this card in last 7 days',
  },
  community: {
    key: 'community',
    label: 'Community Volume',
    icon: '💬',
    color: '#4ECDC4',
    description: 'Reddit posts, TikTok mentions, X/Twitter activity',
  },
  ip_momentum: {
    key: 'ip_momentum',
    label: 'IP Momentum',
    icon: '🎬',
    color: '#FFE66D',
    description: 'Anime episodes, game releases, movie tie-ins',
  },
  editorial: {
    key: 'editorial',
    label: 'Editorial Attention',
    icon: '📰',
    color: '#A8E6CF',
    description: 'TCG news articles, set reviews, "top cards" lists',
  },
  competitive: {
    key: 'competitive',
    label: 'Competitive Demand',
    icon: '🏆',
    color: '#6C5CE7',
    description: 'Tournament top 8 appearances, ban list status',
  },
  scarcity: {
    key: 'scarcity',
    label: 'Print Scarcity',
    icon: '💎',
    color: '#FDA7DF',
    description: 'Print run size, PSA population, out of print status',
  },
  jp_price: {
    key: 'jp_price',
    label: 'JP Price Signal',
    icon: '💴',
    color: '#FF1744',
    description: 'Japanese market price vs English, arbitrage gap',
  },
  jp_hype: {
    key: 'jp_hype',
    label: 'JP Community Buzz',
    icon: '🗾',
    color: '#F50057',
    description: 'Japanese Twitter/X, YouTube, Mercari JP trending',
  },
  jp_release: {
    key: 'jp_release',
    label: 'JP Release Timeline',
    icon: '📅',
    color: '#FF4081',
    description: 'JP set released before EN, time advantage window',
  },
};

// ─── Per-Game Weights ────────────────────────────────────────────────────────
// Each game has different market dynamics that determine which signals matter most.

export const WEIGHTS = {
  'yugioh': {
    competitive: 0.25,
    scarcity: 0.20,
    jp_price: 0.12,
    creator: 0.10,
    jp_hype: 0.08,
    editorial: 0.07,
    community: 0.08,
    ip_momentum: 0.05,
    jp_release: 0.05,
  },
  'pokemon': {
    ip_momentum: 0.20,
    scarcity: 0.20,
    creator: 0.15,
    jp_price: 0.12,
    jp_hype: 0.08,
    community: 0.08,
    editorial: 0.07,
    jp_release: 0.05,
    competitive: 0.05,
  },
  'mtg': {
    competitive: 0.28,
    scarcity: 0.22,
    creator: 0.12,
    community: 0.10,
    editorial: 0.08,
    jp_price: 0.08,
    ip_momentum: 0.05,
    jp_hype: 0.04,
    jp_release: 0.03,
  },
};

// ─── Sample Cards (Quick Picks) ──────────────────────────────────────────────

export const SAMPLE_CARDS = [
  // Pokémon
  { name: 'Mega Dragonite ex', set: 'Ascended Heroes', game: 'pokemon', year: "'26" },
  { name: 'Mega Zygarde ex', set: 'Perfect Order', game: 'pokemon', year: "'26" },
  { name: 'Mega Charizard X ex', set: 'Phantasmal Flames', game: 'pokemon', year: "'25" },
  // Yu-Gi-Oh!
  { name: 'Fiendsmith Lurgia', set: 'Legacy of Destruction', game: 'yugioh' },
  { name: 'Snake-Eye Ash', set: 'Age of Overlord', game: 'yugioh' },
  // MTG
  { name: 'Atraxa, Grand Unifier', set: 'Phyrexia: All Will Be One', game: 'mtg' },
  { name: 'The One Ring', set: 'LOTR: Tales of Middle-earth', game: 'mtg' },
  // Classics
  { name: 'Blue-Eyes White Dragon', set: 'LOB-001', game: 'yugioh', classic: true },
  { name: 'Black Lotus', set: 'Alpha', game: 'mtg', classic: true },
];

// ─── Game Display Labels ─────────────────────────────────────────────────────

export const GAME_LABELS = {
  pokemon: { label: 'Pokémon', color: '#FFD700' },
  yugioh: { label: 'Yu-Gi-Oh!', color: '#B388FF' },
  mtg: { label: 'Magic: The Gathering', color: '#FF8A65' },
};

// ─── Score Thresholds ────────────────────────────────────────────────────────

export function getScoreLabel(score) {
  if (score >= 75) return { label: 'HOT', color: '#FF1744' };
  if (score >= 50) return { label: 'WARMING', color: '#FF9100' };
  if (score >= 30) return { label: 'LUKEWARM', color: '#FFD600' };
  return { label: 'COLD', color: '#546E7A' };
}

// ─── Weighted Score Calculator ───────────────────────────────────────────────

export function calculateOverallScore(signals, game) {
  const weights = WEIGHTS[game];
  if (!weights) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const signal = signals.find(s => s.key === key);
    if (signal && typeof signal.level === 'number') {
      weightedSum += (signal.level / 5) * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}
