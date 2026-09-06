// ─── Structured Card Data Fetcher ────────────────────────────────────────────
// Pulls live card + price data from free TCG APIs before hitting the LLM.
// Returns a structured object the LLM prompt can inject directly, eliminating
// the 2-3 web searches it would otherwise spend looking up EN prices.
//
// APIs used (all free, same ones already powering card images):
//   Pokemon TCG API  — pokemontcg.io       (prices via TCGPlayer + Cardmarket)
//   Scryfall         — api.scryfall.com    (MTG prices + legality + EDHREC rank)
//   YGOPRODeck       — db.ygoprodeck.com   (YGO prices from TCGPlayer/Cardmarket)

import { fetchWithTimeout } from './http.js';

// `pin` is a card picked from the search suggestions: {id, game, ...}. Without
// it we look the name up and take the first hit, which for "Charizard" is one
// arbitrary printing out of hundreds — different set, different rarity,
// different price. With it we fetch that exact card by catalogue id.
export async function fetchCardData(cardName, game, pin = null) {
  try {
    if (pin?.printingId || pin?.id) {
      const exact = await fetchPinned(pin);
      if (exact) return exact;
      // A chosen catalogue row is a hard identity boundary. Falling back to a
      // name search can join the pin's set/number to another printing's price,
      // rarity, and set total. A dead pin is therefore a miss, not permission
      // to guess.
      return cardDataFromPin(cardName, game, pin);
    }
    if (game === 'pokemon') return await fetchPokemonData(cardName);
    if (game === 'mtg')     return await fetchMTGData(cardName);
    if (game === 'yugioh')  return await fetchYGOData(cardName);
    // Game unknown — race all three, return first hit
    const results = await Promise.allSettled([
      fetchPokemonData(cardName),
      fetchMTGData(cardName),
      fetchYGOData(cardName),
    ]);
    return results.find(r => r.status === 'fulfilled' && r.value)?.value ?? null;
  } catch {
    return null;
  }
}

function cardDataFromPin(cardName, game, pin) {
  const trustedSource = ['TCGplayer', 'Scryfall', 'YGOPRODeck'].includes(pin?.priceSource);
  if (!pin?.setName || !pin?.number || (!pin?.imageUrl && !pin?.imageLarge && !trustedSource)) return null;
  const price = Number(pin.price);
  const hasPrice = trustedSource && Number.isFinite(price) && price > 0;
  return {
    game: game || pin.game || null,
    catalogId: pin.id || null,
    printingId: pin.printingId || pin.id || null,
    name: pin.baseName || pin.name || cardName,
    setName: pin.setName,
    setId: pin.setId || null,
    number: pin.number,
    printedTotal: pin.printedTotal || null,
    rarity: pin.rarity || null,
    form: pin.form || null,
    finish: pin.finish || null,
    priceLines: hasPrice ? [`${pin.priceSource} exact-print market price: $${price.toFixed(2)}`] : null,
    priceScope: hasPrice ? `exact-print ${pin.priceSource} market price` : 'exact-print price unavailable',
    priceSource: hasPrice ? pin.priceSource : null,
    priceUrl: pin.priceUrl || null,
    imageUrl: pin.imageLarge || pin.imageUrl || null,
  };
}

// ─── Exact printing, by catalogue id ─────────────────────────────────────────
// Every suggestion row carries the id its own catalogue gave it, so this is a
// single direct GET — no name matching, no ranking, no guessing.

// Scryfall rejects requests without one.
const SCRYFALL_HEADERS = { 'User-Agent': 'SignalTCG/1.0', Accept: 'application/json' };

// pokemontcg.io answers with 500/502 on roughly half of all requests — measured,
// not guessed. Unretried, that silently dropped the pre-fetched price block from
// a large share of Pokémon scans and sent the model off to web-search a price we
// already had. 4xx is a real answer and is returned as-is; 5xx and network
// errors get another go.
async function retryFetch(url, init, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetchWithTimeout(url, init || {}, 8000);
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      last = new Error(String(res.status));
    } catch (e) {
      last = e;
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 350 * (i + 1)));
  }
  throw last;
}

async function fetchPinned(pin) {
  try {
    if (pin.game === 'pokemon') {
      const id = pin.id || pin.catalogId || pin.printingId;
      if (!id) return null;
      if (pin.source === 'tcgdex') return fetchTcgDexPokemonData(id, pin);
      try {
        const res = await retryFetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data) return applyTrustedPinMarketPrice(shapePokemon(data.data, pin), pin);
        }
      } catch {}
      return fetchTcgDexPokemonData(id, pin);
    }
    if (pin.game === 'mtg') {
      const id = pin.id || pin.catalogId || pin.printingId;
      if (!id) return null;
      const res = await retryFetch(`https://api.scryfall.com/cards/${encodeURIComponent(id)}`, {
        headers: SCRYFALL_HEADERS,
      });
      if (!res.ok) return null;
      const card = await res.json();
      return card.object === 'error' ? null : applyTrustedPinMarketPrice(shapeMTG(card, pin), pin);
    }
    if (pin.game === 'yugioh') {
      const lookup = pin.id
        ? `id=${encodeURIComponent(pin.id)}`
        : `name=${encodeURIComponent(pin.baseName || pin.name || '')}`;
      const res = await retryFetch(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?${lookup}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error) return null;
      return data.data?.[0] ? applyTrustedPinMarketPrice(shapeYGO(data.data[0], pin), pin) : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function applyTrustedPinMarketPrice(cardData, pin) {
  const price = Number(pin?.price);
  const trusted = ['TCGplayer', 'Scryfall', 'YGOPRODeck'].includes(pin?.priceSource);
  const exactFreshPrice = cardData?.priceScope === 'exact finish' && cardData?.priceLines?.length;
  if (!cardData || !trusted || !Number.isFinite(price) || price <= 0 || exactFreshPrice) return cardData;
  const finish = pin?.finish ? ` ${pin.finish}` : '';
  return {
    ...cardData,
    priceLines: [`${pin.priceSource} exact-print${finish} market price: $${price.toFixed(2)}`],
    priceScope: `exact-print ${pin.priceSource} market price`,
    priceSource: pin.priceSource,
    priceUrl: pin.priceUrl || null,
  };
}

// ─── Pokémon TCG API ──────────────────────────────────────────────────────────

async function fetchTcgDexPokemonData(cardId, pin = null) {
  const res = await retryFetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(cardId)}`, {}, 2);
  if (!res.ok) return null;
  const card = await res.json();
  if (!card?.id || !card?.name) return null;
  const priceLines = [];
  const labels = {
    normal: 'Normal',
    holofoil: 'Holofoil',
    'reverse-holofoil': 'Reverse Holo',
    '1st-edition-holofoil': '1st Ed Holo',
    'unlimited-holofoil': 'Unlimited Holo',
  };
  const formKeys = {
    normal: ['normal'],
    holo: ['holofoil'],
    reverse: ['reverse-holofoil'],
    first_edition_normal: ['1st-edition-normal'],
    first_edition_holo: ['1st-edition-holofoil'],
    unlimited_normal: ['unlimited-normal'],
    unlimited_holo: ['unlimited-holofoil'],
  };
  for (const [variant, value] of Object.entries(card.pricing?.tcgplayer || {})) {
    const allowed = pin?.form ? formKeys[pin.form] || [] : null;
    if (allowed && !allowed.includes(variant)) continue;
    const market = Number(value?.marketPrice);
    if (!Number.isFinite(market) || market <= 0) continue;
    const parts = [`$${market.toFixed(2)} market`];
    const low = Number(value?.lowPrice);
    const high = Number(value?.highPrice);
    if (Number.isFinite(low) && low > 0) parts.push(`$${low.toFixed(2)} low`);
    if (Number.isFinite(high) && high > 0) parts.push(`$${high.toFixed(2)} high`);
    priceLines.push(`${labels[variant] || variant}: ${parts.join(' / ')}`);
  }
  const eu = Number(card.pricing?.cardmarket?.avg30);
  const legalFormats = Object.entries(card.legal || {})
    .filter(([, value]) => String(value).toLowerCase() === 'legal')
    .map(([format]) => format);
  return applyTrustedPinMarketPrice({
    game: 'pokemon',
    catalogId: card.id,
    printingId: card.id,
    name: card.name,
    setName: card.set?.name || null,
    setId: card.set?.id || null,
    setLogoUrl: card.set?.logo ? `${card.set.logo}/high.webp` : null,
    number: card.localId || null,
    printedTotal: card.set?.cardCount?.official || card.set?.cardCount?.total || null,
    rarity: card.rarity || null,
    form: pin?.form || null,
    finish: pin?.finish || null,
    priceLines: priceLines.length ? priceLines : null,
    priceScope: pin?.form ? (priceLines.length ? 'exact finish' : 'exact-print price unavailable') : null,
    priceSource: 'TCGplayer',
    euTrend: Number.isFinite(eu) && eu > 0 ? `€${eu.toFixed(2)} (EU 30-day avg)` : null,
    legalFormats,
    tcgplayerUrl: null,
    imageUrl: card.image ? `${card.image}/high.webp` : null,
  }, pin);
}

async function fetchPokemonData(cardName) {
  const cleanName = cardName
    .replace(/"/g, '')
    .trim();

  const res = await retryFetch(
    `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cleanName)}"&pageSize=3&orderBy=-set.releaseDate`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.data?.[0];
  if (!card) return null;
  return shapePokemon(card);
}

const POKEMON_FORM_KEYS = {
  normal: ['normal'],
  holo: ['holofoil'],
  reverse: ['reverseHolofoil'],
  first_edition_normal: ['1stEditionNormal'],
  first_edition_holo: ['1stEditionHolofoil'],
  unlimited_normal: ['unlimitedNormal'],
  unlimited_holo: ['unlimitedHolofoil'],
};

function shapePokemon(card, pin = null) {
  const p = card.tcgplayer?.prices || {};
  const priceLines = [];
  const variants = [
    ['holofoil', 'Holofoil'],
    ['reverseHolofoil', 'Reverse Holo'],
    ['normal', 'Normal'],
    ['1stEditionNormal', '1st Ed Normal'],
    ['1stEditionHolofoil', '1st Ed Holo'],
    ['unlimitedNormal', 'Unlimited Normal'],
    ['unlimitedHolofoil', 'Unlimited Holo'],
  ];
  for (const [key, label] of variants) {
    const allowed = pin?.form ? POKEMON_FORM_KEYS[pin.form] || [] : null;
    if (allowed && !allowed.includes(key)) continue;
    const v = p[key];
    if (!v?.market) continue;
    const parts = [`$${v.market.toFixed(2)} market`];
    if (v.low)  parts.push(`$${v.low.toFixed(2)} low`);
    if (v.high) parts.push(`$${v.high.toFixed(2)} high`);
    priceLines.push(`${label}: ${parts.join(' / ')}`);
  }

  const cm = card.cardmarket?.prices;
  const euTrend = cm?.avg30 ? `€${cm.avg30.toFixed(2)} (EU 30-day avg)` : null;

  const legalFormats = Object.entries(card.legalities || {})
    .filter(([, v]) => v === 'Legal')
    .map(([k]) => k);

  return {
    game: 'pokemon',
    catalogId: card.id || null,
    printingId: card.id || null,
    name: card.name,
    setName: card.set?.name,
    setId: card.set?.id,
    setLogoUrl: card.set?.images?.logo || null,
    number: card.number,
    // The number printed on a Pokémon card is "161/131", not "161". Showing
    // half of it means the reader still has to go and check.
    printedTotal: card.set?.printedTotal || card.set?.total || null,
    rarity: card.rarity,
    form: pin?.form || null,
    finish: pin?.finish || null,
    priceLines: priceLines.length ? priceLines : null,
    priceScope: pin?.form ? (priceLines.length ? 'exact finish' : 'exact-print price unavailable') : null,
    priceSource: 'TCGplayer',
    euTrend,
    legalFormats,
    tcgplayerUrl: card.tcgplayer?.url,
    imageUrl: card.images?.large || card.images?.small,
  };
}

// ─── Scryfall (MTG) ───────────────────────────────────────────────────────────

async function fetchMTGData(cardName) {
  const res = await retryFetch(
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`,
    { headers: SCRYFALL_HEADERS }
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const card = await res.json();
  if (card.object === 'error') return null;
  return shapeMTG(card);
}

function shapeMTG(card, pin = null) {
  const prices = card.prices || {};
  const priceLines = [];
  if (!pin?.form || pin.form === 'normal') {
    if (prices.usd) priceLines.push(`Non-foil: $${prices.usd}`);
    if (prices.eur) priceLines.push(`EUR: €${prices.eur}`);
  }
  if (!pin?.form || pin.form === 'foil') {
    if (prices.usd_foil) priceLines.push(`Foil: $${prices.usd_foil}`);
    if (prices.eur_foil) priceLines.push(`EUR Foil: €${prices.eur_foil}`);
  }
  if (!pin?.form || pin.form === 'etched') {
    if (prices.usd_etched) priceLines.push(`Etched: $${prices.usd_etched}`);
  }
  if (!pin?.form && prices.tix) priceLines.push(`MTGO: ${prices.tix} tix`);

  const legalFormats = Object.entries(card.legalities || {})
    .filter(([, v]) => v === 'legal')
    .map(([k]) => k);

  return {
    game: 'mtg',
    catalogId: card.id || null,
    printingId: card.id || null,
    name: card.name,
    setName: card.set_name,
    setId: card.set,
    number: card.collector_number,
    rarity: card.rarity,
    form: pin?.form || null,
    finish: pin?.finish || null,
    typeLine: card.type_line,
    priceLines: priceLines.length ? priceLines : null,
    priceScope: pin?.form ? (priceLines.length ? 'exact finish' : 'exact-print price unavailable') : null,
    priceSource: 'Scryfall',
    legalFormats,
    edhrecRank: card.edhrec_rank,
    imageUrl: card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large,
    scryfallUri: card.scryfall_uri,
  };
}

// ─── YGOPRODeck (Yu-Gi-Oh!) ──────────────────────────────────────────────────

async function fetchYGOData(cardName) {
  const res = await retryFetch(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(cardName)}`
  );
  if (res.status === 400) return null;
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  const card = data.data?.[0];
  if (!card) return null;
  return shapeYGO(card);
}

function shapeYGO(card, pin = null) {
  const p = card.card_prices?.[0] || {};
  const prints = Array.isArray(card.card_sets) ? card.card_sets : [];
  const wantedCodes = [pin?.number, pin?.setId, pin?.printingId?.split(':').slice(1).join(':')]
    .filter(Boolean)
    .map((value) => String(value).trim().toUpperCase());
  const wantedName = String(pin?.setName || '').trim().toLowerCase();
  const wantedRarity = String(pin?.rarity || '').trim().toLowerCase();
  const chosen = pin
    ? prints.find((entry) => wantedCodes.includes(String(entry.set_code || '').trim().toUpperCase())
        && wantedRarity && String(entry.set_rarity || '').trim().toLowerCase() === wantedRarity)
      || prints.find((entry) => wantedCodes.includes(String(entry.set_code || '').trim().toUpperCase()))
      || prints.find((entry) => wantedName && String(entry.set_name || '').trim().toLowerCase() === wantedName)
      || null
    : (prints[0] || null);

  if (pin && !chosen) return null;

  const priceLines = [];
  const exactSetPrice = Number(chosen?.set_price);
  const hasExactSetPrice = Number.isFinite(exactSetPrice) && exactSetPrice > 0;
  const exactPrintingRequested = Boolean(pin && chosen?.set_code);
  const nonZero = (v) => v && v !== '0.00';
  if (hasExactSetPrice) priceLines.push(`Market price: $${exactSetPrice.toFixed(2)}`);
  else if (!exactPrintingRequested && nonZero(p.tcgplayer_price)) priceLines.push(`Market price across printings: $${p.tcgplayer_price}`);
  if (!hasExactSetPrice && !exactPrintingRequested && nonZero(p.cardmarket_price)) {
    priceLines.push(`Cardmarket across printings: €${p.cardmarket_price}`);
  }

  const recentSets = (card.card_sets || [])
    .slice(-3)
    .map(s => `${s.set_name} (${s.set_rarity})`);

  return {
    game: 'yugioh',
    catalogId: card.id != null ? String(card.id) : null,
    printingId: chosen?.set_code && card.id != null ? `${card.id}:${chosen.set_code}` : (card.id != null ? String(card.id) : null),
    name: card.name,
    // Yu-Gi-Oh's identifier is the set code stamped on the card — "LOB-EN005".
    // This shape returned neither a set nor a number, so Yu-Gi-Oh results could
    // never show which printing they were about.
    setName: chosen?.set_name || null,
    setId: chosen?.set_code || null,
    number: chosen?.set_code || null,
    rarity: chosen?.set_rarity || null,
    type: card.type,
    race: card.race,
    archetype: card.archetype,
    priceLines: priceLines.length ? priceLines : null,
    priceScope: hasExactSetPrice
      ? 'set-code printing'
      : (exactPrintingRequested ? 'exact-print price unavailable' : 'card-level across all printings'),
    priceSource: hasExactSetPrice ? 'YGOPRODeck' : null,
    recentSets: recentSets.length ? recentSets : null,
    imageUrl: card.card_images?.[0]?.image_url,
  };
}

export function applyTrustedMarketPrice(prices, cardData, currentPrice) {
  const clean = { ...(prices || {}) };
  if (currentPrice !== null) clean.en_price = `$${currentPrice.toFixed(2)}`;
  else if (cardData?.priceScope === 'exact-print price unavailable') clean.en_price = '';
  // No supported catalogue currently supplies exact 30-day price history for
  // all three games. Model prose is not a price feed.
  clean.trend_30d = cardData?.trend30d || '';
  return clean;
}

function scrubBroadPriceText(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/(?:the\s+)?all[- ]printing market price of\s*\$\s?[\d,.]+/gi, 'broad card-level pricing')
    .replace(/\$\s?[\d,.]+/g, 'an unverified broad-card figure');
}

export function applyTrustedPriceNarrative(analysis, cardData) {
  if (!analysis || cardData?.priceScope !== 'exact-print price unavailable') return analysis;
  return {
    ...analysis,
    _exactPriceUnavailable: true,
    summary: scrubBroadPriceText(analysis.summary),
    signals: (analysis.signals || []).map((signal) => ({
      ...signal,
      detail: scrubBroadPriceText(signal.detail),
      sources: (signal.sources || []).map((source) => ({
        ...source,
        summary: scrubBroadPriceText(source.summary),
      })),
    })),
  };
}

export function sanitizeCachedPriceNarrative(data) {
  if (!data) return data;
  const exactPriceUnavailable = data?._exactPriceUnavailable
    || (data?._pin?.game === 'yugioh' && data?.prices?.en_price === '');
  const cleaned = {
    ...data,
    prices: {
      ...(data.prices || {}),
      trend_30d: data._trend30dVerified ? (data.prices?.trend_30d || '') : '',
    },
  };
  return exactPriceUnavailable
    ? applyTrustedPriceNarrative(cleaned, { priceScope: 'exact-print price unavailable' })
    : cleaned;
}

// ─── Prompt injection helper ──────────────────────────────────────────────────
// Formats fetched card data as a compact block for the LLM user message.

export function buildCardDataBlock(cardData) {
  if (!cardData) return null;
  const lines = ['=== PRE-FETCHED MARKET DATA (live TCG API — do NOT re-search EN prices) ==='];

  if (cardData.name)    lines.push(`Card: ${cardData.name}`);
  if (cardData.setName) lines.push(`Set: ${cardData.setName}${cardData.setId ? ' [' + cardData.setId + ']' : ''}`);
  if (cardData.number)  lines.push(`Number: ${cardData.number}`);
  if (cardData.rarity)  lines.push(`Rarity: ${cardData.rarity}`);
  if (cardData.typeLine) lines.push(`Type: ${cardData.typeLine}`);
  if (cardData.archetype) lines.push(`Archetype: ${cardData.archetype}`);
  if (cardData.race)    lines.push(`Race: ${cardData.race}`);
  if (cardData.edhrecRank) lines.push(`EDHREC rank: #${cardData.edhrecRank} (Commander popularity)`);
  if (cardData.recentSets?.length) lines.push(`Recent printings: ${cardData.recentSets.join(', ')}`);

  if (cardData.priceLines?.length) {
    const src = cardData.priceSource ? ` (${cardData.priceSource})` : ' (live)';
    lines.push('', `EN PRICES${src}:`);
    cardData.priceLines.forEach(p => lines.push(`  • ${p}`));
  }
  if (cardData.priceScope) lines.push(`Price scope: ${cardData.priceScope}`);
  if (cardData.euTrend) lines.push(`  • ${cardData.euTrend}`);
  if (cardData.trend30d) lines.push(`30-day trend: ${cardData.trend30d}`);

  if (cardData.legalFormats?.length) {
    lines.push(`Legal in: ${cardData.legalFormats.join(', ')}`);
  }

  lines.push('=== END PRE-FETCHED DATA ===');
  return lines.join('\n');
}
