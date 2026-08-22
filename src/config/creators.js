// ─── Creator Directory ───────────────────────────────────────────────────────
// Curated list of TCG creators worth tracking per game. The Signal prompt
// uses this as a recognition list. A broad YouTube query does not prove every
// creator was checked, so the app may report matched names but never invents
// silence for the rest.
//
// Tiers:
//   T1 — flagship audience or proven price-moving impact
//   T2 — mid-tier reach, consistent commentary
//   T3 — niche but credible voices

export const CREATOR_DIRECTORY = {
  pokemon: {
    en: [
      { name: 'Leonhart', tier: 'T1', focus: 'premium openings' },
      { name: 'PokeRev', tier: 'T1', focus: 'mass-audience openings' },
      { name: 'Real Break Reviews', tier: 'T1', focus: 'early calls / underpriced' },
      { name: 'Tricky Gym', tier: 'T2', focus: 'competitive deck-tech' },
      { name: 'TCG Protectors', tier: 'T2', focus: 'strategy + market' },
      { name: 'Smpratte', tier: 'T2', focus: 'competitive coverage' },
      { name: 'Ace Trainer Liam', tier: 'T3', focus: 'reviews / vlog' },
      { name: 'PokeBeach', tier: 'T2', focus: 'editorial / news' },
    ],
    jp: [
      { name: 'ポケカ実況たかし', tier: 'T1', focus: 'mass-audience JP openings' },
      { name: 'やまだ', tier: 'T2', focus: 'JP opening commentary' },
      { name: 'ポケカマン', tier: 'T2', focus: 'JP strategy' },
      { name: '価格ナビ', tier: 'T2', focus: 'JP price tracking' },
    ],
  },
  mtg: {
    en: [
      { name: 'Alpha Investments / Rudy', tier: 'T1', focus: 'finance — single biggest price mover' },
      { name: 'The Professor / Tolarian Community College', tier: 'T1', focus: 'flagship reviewer' },
      { name: 'CovertGoBlue', tier: 'T1', focus: 'speculation / spec-runs' },
      { name: 'MTGGoldfish', tier: 'T2', focus: 'deck-tech + editorial' },
      { name: 'Saffron Olive', tier: 'T2', focus: 'budget / jank decks' },
      { name: 'The Command Zone', tier: 'T2', focus: 'Commander flagship' },
      { name: 'MTG Lion', tier: 'T3', focus: 'finance-heavy' },
      { name: 'Crimstone', tier: 'T3', focus: 'opening / sealed reviews' },
    ],
    jp: [
      // MTG-JP creator coverage is thin; relying on JP marketplaces + Twitter/X
      { name: 'Hareruya Twitter/X', tier: 'T2', focus: 'JP store-front signal' },
    ],
  },
  yugioh: {
    en: [
      { name: 'Cimoooooooo', tier: 'T1', focus: 'competitive — large audience' },
      { name: 'MBT (Mike B)', tier: 'T1', focus: 'deep strategy + deck-tech' },
      { name: 'Farfa', tier: 'T2', focus: 'competitive deck profiles' },
      { name: 'TeamAPS', tier: 'T2', focus: 'opening + investment' },
      { name: 'Dkayed', tier: 'T2', focus: 'meta analysis / store stream' },
      { name: 'Joey Steel', tier: 'T3', focus: 'competitive editorials' },
      { name: 'SamX1 / TeamSamuraiX1', tier: 'T3', focus: 'opening / scarcity' },
      { name: 'The Organization', tier: 'T2', focus: 'editorial / news' },
    ],
    jp: [
      // YGO-JP creator coverage is thin; relying on JP card-shop streams + Mercari
    ],
  },
};

export const TIER_META = {
  T1: { color: '#C44040', label: 'T1' },
  T2: { color: '#A09060', label: 'T2' },
  T3: { color: '#608870', label: 'T3' },
  unknown: { color: '#605C54', label: '—' },
};

// Render a creator list as a string for prompt injection
export function creatorListForPrompt(game) {
  const dir = CREATOR_DIRECTORY[game];
  if (!dir) return '(no curated list — search broadly across YouTube/Reddit/Twitter)';
  const enList = dir.en.map((c) => `  - [${c.tier}] ${c.name} (${c.focus})`).join('\n');
  const jpList = dir.jp.length
    ? dir.jp.map((c) => `  - [${c.tier}] ${c.name} (${c.focus})`).join('\n')
    : '  (none curated)';
  return `EN creators:\n${enList}\n\nJP creators:\n${jpList}`;
}
