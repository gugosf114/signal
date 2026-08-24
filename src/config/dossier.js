export const DOSSIER_SCOPE = [
  { key: 'pokemon', label: 'Pokémon' },
  { key: 'yugioh', label: 'Yu-Gi-Oh!' },
  { key: 'mtg', label: 'Magic' },
];

export const DOSSIER_METHOD = [
  {
    number: '01',
    title: 'Exact printing',
    body: 'We lock the set, number, rarity, artwork, and release before research begins.',
  },
  {
    number: '02',
    title: 'Source research',
    body: 'We check product records, card databases, exact sales, grading populations, tournament data, and collector activity.',
  },
  {
    number: '03',
    title: 'Full context',
    body: 'We test scarcity, demand, play history, reprints, attention, and the facts that could change the card\'s standing.',
  },
  {
    number: '04',
    title: 'Decision pressure test',
    body: 'We build the strongest retain and reallocate cases, then name the evidence that would flip the lean.',
  },
  {
    number: '05',
    title: 'Human review',
    body: 'AI gathers and compares. A human researcher challenges weak claims and reviews the finished file.',
  },
];

export const DOSSIER_SAMPLE = {
  cardName: 'Reinforcement of the Army',
  setName: 'Legendary Modern Decks 2026',
  number: 'L26D-ENS08',
  rarity: 'Starlight Rare',
  finding: 'A bonus-slot Starlight upgrade, not an ordinary booster pull.',
  known: 'Exact identity and release mechanics are verified.',
  unknown: 'Upgrade odds and an exact market price are not established.',
  pdfPath: '/samples/signal-dossier-reinforcement-sample.pdf',
  filename: 'signal-dossier-reinforcement-sample.pdf',
};
