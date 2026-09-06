// Creator evidence must be about the physical printing in the report.
// A real YouTube URL only proves that the video exists. It does not prove that
// a Rayquaza video shows the same Rayquaza printing.

function normalized(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[δΔ]/g, ' delta ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function includesPhrase(haystack, needle) {
  const wanted = normalized(needle);
  return Boolean(wanted && ` ${normalized(haystack)} `.includes(` ${wanted} `));
}

function nameMatches(text, cardName) {
  const firstFace = String(cardName || '').split('//')[0].trim();
  return includesPhrase(text, firstFace);
}

function exactAnchors(pin) {
  if (!pin) return [];
  const anchors = [pin.setName, pin.setCode, pin.sourceCode];
  if (pin.sourceCode && pin.number) anchors.push(`${pin.sourceCode}-${pin.number}`);
  if (pin.setCode && pin.number) anchors.push(`${pin.setCode}-${pin.number}`);
  // Yu-Gi-Oh set numbers are strong IDs. Bare Pokémon/MTG collector numbers
  // are weak words ("97" can be a price or view count), so require #number.
  if (pin.game === 'yugioh' && pin.number) anchors.push(pin.number);
  if (pin.number && pin.game !== 'yugioh') anchors.push(`#${pin.number}`);
  if (pin.printedTotal && pin.number) anchors.push(`${pin.number}/${pin.printedTotal}`);
  return [...new Set(anchors.map(normalized).filter((value) => value.length >= 3))];
}

export function sourceMatchesExactPrinting(source, cardName, pin) {
  const text = [source?.title, source?.description].filter(Boolean).join(' ');
  if (!text || !nameMatches(text, cardName)) return false;
  const haystack = ` ${normalized(text)} `;
  return exactAnchors(pin).some((anchor) => haystack.includes(` ${anchor} `));
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
      return allow === null
        ? sourceMatchesExactPrinting(source, cardName, pin)
        : Boolean(url && allow.has(url));
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
