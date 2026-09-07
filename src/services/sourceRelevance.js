// Creator evidence must be about the physical printing in the report.
// A real YouTube URL only proves that the video exists. It does not prove that
// a Rayquaza video shows the same Rayquaza printing.
//
// 2026-09-06: the first version demanded the exact catalogue name. Real
// creators do not say "Umbreon ex Special Illustration Rare"; they say
// "UMBREON SIR from Prismatic Evolutions". Measured against the live YouTube
// answer for that card, the strict rule rejected 6 of 6 real videos, so the
// creator lane read "no exact-print source" on the most-watched card of the
// year. The rule now accepts a creator's shorthand as long as the video still
// pins the exact printing: the card's base name, the set, and either the
// collector number or the premium rarity.

function normalized(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[δΔ]/g, ' delta ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function includesPhrase(haystack, needle) {
  const wanted = normalized(needle);
  return Boolean(wanted && ` ${normalized(haystack)} `.includes(` ${wanted} `));
}

function firstFace(cardName) {
  return String(cardName || '').split('//')[0].trim();
}

function nameMatches(text, cardName) {
  return includesPhrase(text, firstFace(cardName));
}

// "Umbreon ex", "Charizard VMAX", "Pikachu V": the mechanic suffix is what
// creators drop first. Pokémon only; a Magic name is never shortened.
const POKEMON_SUFFIX_RE = /\s+(?:ex|gx|v|vmax|vstar|break|lv\.?\s?x|prime|legend|star|tag team)$/i;

export function baseCardName(cardName, game = 'pokemon') {
  const name = firstFace(cardName);
  if (game !== 'pokemon') return name;
  const stripped = name.replace(POKEMON_SUFFIX_RE, '').trim();
  return stripped || name;
}

// Premium rarities and the shorthand collectors use for them. Plain "rare",
// "common", and "uncommon" are deliberately absent: they pin nothing.
const RARITY_ALIASES = [
  [/special illustration rare/, ['special illustration rare', 'special illustration', 'sir']],
  [/(?:^| )illustration rare/, ['illustration rare', 'ir']],
  [/hyper rare/, ['hyper rare', 'hyper']],
  [/ultra rare/, ['ultra rare']],
  [/secret rare/, ['secret rare', 'secret']],
  [/starlight/, ['starlight rare', 'starlight']],
  [/quarter century/, ['quarter century', 'qcsr']],
  [/collector'?s? rare/, ['collectors rare', 'collector s rare']],
  [/ghost rare/, ['ghost rare']],
  [/gold rare/, ['gold rare']],
  [/(?:alternate|alt) art/, ['alternate art', 'alt art']],
  [/full art/, ['full art']],
  [/extended art/, ['extended art']],
  [/borderless/, ['borderless']],
  [/serialized/, ['serialized', 'serial']],
];

export function rarityAnchors(rarity) {
  const wanted = normalized(rarity);
  if (!wanted) return [];
  const anchors = new Set();
  for (const [pattern, aliases] of RARITY_ALIASES) {
    if (pattern.test(wanted)) for (const alias of aliases) anchors.add(normalized(alias));
  }
  return [...anchors].filter(Boolean);
}

// Shorthand a creator would put in a title, for the fallback search query.
export function rarityShorthand(rarity) {
  const wanted = normalized(rarity);
  if (/special illustration rare/.test(wanted)) return 'SIR';
  if (/(?:^| )illustration rare/.test(wanted)) return 'IR';
  if (/hyper rare/.test(wanted)) return 'hyper rare';
  if (/starlight/.test(wanted)) return 'Starlight';
  if (/quarter century/.test(wanted)) return 'Quarter Century';
  if (/secret rare/.test(wanted)) return 'Secret Rare';
  if (/(?:alternate|alt) art/.test(wanted)) return 'alt art';
  if (/full art/.test(wanted)) return 'full art';
  return '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// "Prismatic Evolution" and "Prismatic Evolutions" name the same set.
function setNameMatches(haystack, setName) {
  const words = normalized(setName).split(' ').filter(Boolean);
  if (!words.length) return false;
  const pattern = words.map((word) => `${escapeRegExp(word.replace(/s$/, ''))}s?`).join(' ');
  return new RegExp(`(?:^| )${pattern}(?: |$)`).test(` ${normalized(haystack)} `);
}

function codeAnchors(pin) {
  if (!pin) return [];
  const anchors = [pin.setCode, pin.sourceCode];
  if (pin.sourceCode && pin.number) anchors.push(`${pin.sourceCode}-${pin.number}`);
  if (pin.setCode && pin.number) anchors.push(`${pin.setCode}-${pin.number}`);
  return [...new Set(anchors.map(normalized).filter((value) => value.length >= 3))];
}

function numberAnchors(pin) {
  if (!pin) return [];
  const anchors = [];
  // Yu-Gi-Oh set numbers are strong IDs. Bare Pokémon/MTG collector numbers
  // are weak words ("97" can be a price or view count), so require #number.
  if (pin.game === 'yugioh' && pin.number) anchors.push(pin.number);
  if (pin.number && pin.game !== 'yugioh') anchors.push(`#${pin.number}`);
  if (pin.printedTotal && pin.number) anchors.push(`${pin.number}/${pin.printedTotal}`);
  return [...new Set(anchors.map(normalized).filter((value) => value.length >= 3))];
}

function exactAnchors(pin) {
  return [...new Set([...codeAnchors(pin), ...numberAnchors(pin), normalized(pin?.setName)].filter((value) => value && value.length >= 3))];
}

export function sourceMatchesExactPrinting(source, cardName, pin) {
  const text = [source?.title, source?.description].filter(Boolean).join(' ');
  if (!text || !pin) return false;
  const haystack = ` ${normalized(text)} `;
  const fullName = nameMatches(text, cardName);
  const base = baseCardName(cardName, pin.game);
  const baseName = !fullName && base !== firstFace(cardName) && includesPhrase(text, base);
  if (!fullName && !baseName) return false;

  const set = (pin.setName && setNameMatches(text, pin.setName))
    || codeAnchors(pin).some((anchor) => haystack.includes(` ${anchor} `));
  const number = numberAnchors(pin).some((anchor) => haystack.includes(` ${anchor} `));
  const rarity = rarityAnchors(pin.rarity).some((anchor) => haystack.includes(` ${anchor} `));

  // The full catalogue name plus any exact anchor is the old rule, unchanged.
  if (fullName) return set || number || rarity;
  // Shorthand needs the set AND something that separates printings inside it.
  return set && (number || rarity);
}

export function exactCreatorQuery(cardName, game, pin) {
  return [
    `"${String(cardName || '').trim()}"`,
    pin?.setName ? `"${pin.setName}"` : '',
    pin?.number || '',
    pin?.rarity ? `"${pin.rarity}"` : '',
    game === 'pokemon' ? 'Pokemon card' : game === 'yugioh' ? 'Yu-Gi-Oh card' : 'Magic card',
  ].filter(Boolean).join(' ');
}

// The way a creator would title it: "Umbreon SIR Prismatic Evolutions".
export function looseCreatorQuery(cardName, game, pin) {
  const shorthand = rarityShorthand(pin?.rarity) || String(pin?.rarity || '').trim();
  return [
    baseCardName(cardName, game),
    shorthand,
    pin?.setName || '',
  ].filter(Boolean).join(' ');
}

export function filterExactVideos(videos, cardName, pin) {
  if (!pin) return [];
  return (Array.isArray(videos) ? videos : [])
    .filter((video) => sourceMatchesExactPrinting(video, cardName, pin));
}

function normalizedUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id ? `youtube:${id}` : null;
    }
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      const id = url.pathname === '/watch'
        ? url.searchParams.get('v')
        : url.pathname.split('/').filter(Boolean)[1];
      return id ? `youtube:${id}` : null;
    }
    url.hash = '';
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function allowedUrlSet(videos) {
  return new Set((videos || []).map((video) => normalizedUrl(video?.url)).filter(Boolean));
}

// New reports pass the exact videos fetched from YouTube. Old cache entries do
// not have that side data, so they use the stricter title + printing check.
export function enforceExactCreatorSources(analysis, {
  cardName = analysis?.card_name || '',
  pin = analysis?._pin || analysis?.printing || null,
  creatorVideos = null,
  jpVideos = null,
} = {}) {
  if (!analysis || !Array.isArray(analysis.signals) || !pin) return analysis;
  const creatorUrls = creatorVideos === null ? null : allowedUrlSet(creatorVideos);
  const jpUrls = jpVideos === null ? null : allowedUrlSet(jpVideos);
  let removed = 0;
  const signals = analysis.signals.map((signal) => {
    if (!Array.isArray(signal?.sources)) return signal;
    const shouldCheck = signal.key === 'creator' || signal.key === 'jp_hype';
    if (!shouldCheck) return signal;
    const allow = signal.key === 'creator' ? creatorUrls : jpUrls;
    const kept = signal.sources.filter((source) => {
      if (signal.key === 'jp_hype' && source?.type !== 'youtube') return true;
      const url = normalizedUrl(source?.url);
      // A video the model found with its own search counts when its title
      // pins the printing, even if the pre-fetch did not return it.
      return (allow !== null && Boolean(url && allow.has(url)))
        || sourceMatchesExactPrinting(source, cardName, pin);
    });
    const dropped = signal.sources.length - kept.length;
    removed += dropped;
    if (kept.length === 0) {
      return {
        ...signal,
        level: 0,
        detail: signal.key === 'creator'
          ? 'No exact-print creator source was found.'
          : 'No exact-print Japanese creator source was found.',
        sources: [],
        dropped: (signal.dropped || 0) + dropped,
      };
    }
    return { ...signal, sources: kept, dropped: (signal.dropped || 0) + dropped };
  });
  return removed
    ? { ...analysis, signals, _droppedTotal: (analysis._droppedTotal || 0) + removed }
    : { ...analysis, signals };
}
