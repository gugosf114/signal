// ─── Structured Card Data Fetcher ────────────────────────────────────────────
// Pulls live card + price data from free TCG APIs before hitting the LLM.
// Returns a structured object the LLM prompt can inject directly, eliminating
// the 2-3 web searches it would otherwise spend looking up EN prices.
//
// APIs used (all free, same ones already powering card images):
//   Pokemon TCG API  — pokemontcg.io       (prices via TCGPlayer + Cardmarket)
//   Scryfall         — api.scryfall.com    (MTG prices + legality + EDHREC rank)
//   YGOPRODeck       — db.ygoprodeck.com   (YGO prices from TCGPlayer/Cardmarket)

export async function fetchCardData(cardName, game) {
  try {
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

// ─── Pokémon TCG API ──────────────────────────────────────────────────────────

async function fetchPokemonData(cardName) {
  const cleanName = cardName
    .replace(/"/g, '')
    .replace(/\s+(ex|EX|V|VMAX|VSTAR|GX)\s*$/i, '')
    .trim();

  const res = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cleanName)}"&pageSize=3&orderBy=-set.releaseDate`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const card = data.data?.[0];
  if (!card) return null;

  const p = card.tcgplayer?.prices || {};
  const priceLines = [];
  const variants = [
    ['holofoil', 'Holofoil'],
    ['reverseHolofoil', 'Reverse Holo'],
    ['normal', 'Normal'],
    ['1stEditionHolofoil', '1st Ed Holo'],
    ['unlimitedHolofoil', 'Unlimited Holo'],
  ];
  for (const [key, label] of variants) {
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
    name: card.name,
    setName: card.set?.name,
    setId: card.set?.id,
    number: card.number,
    rarity: card.rarity,
    priceLines: priceLines.length ? priceLines : null,
    euTrend,
    legalFormats,
    tcgplayerUrl: card.tcgplayer?.url,
    imageUrl: card.images?.large || card.images?.small,
  };
}

// ─── Scryfall (MTG) ───────────────────────────────────────────────────────────

async function fetchMTGData(cardName) {
  const res = await fetch(
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const card = await res.json();
  if (card.object === 'error') return null;

  const prices = card.prices || {};
  const priceLines = [];
  if (prices.usd)       priceLines.push(`Non-foil: $${prices.usd}`);
  if (prices.usd_foil)  priceLines.push(`Foil: $${prices.usd_foil}`);
  if (prices.eur)       priceLines.push(`EUR: €${prices.eur}`);
  if (prices.eur_foil)  priceLines.push(`EUR Foil: €${prices.eur_foil}`);
  if (prices.tix)       priceLines.push(`MTGO: ${prices.tix} tix`);

  const legalFormats = Object.entries(card.legalities || {})
    .filter(([, v]) => v === 'legal')
    .map(([k]) => k);

  return {
    game: 'mtg',
    name: card.name,
    setName: card.set_name,
    rarity: card.rarity,
    typeLine: card.type_line,
    priceLines: priceLines.length ? priceLines : null,
    legalFormats,
    edhrecRank: card.edhrec_rank,
    imageUrl: card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large,
    scryfallUri: card.scryfall_uri,
  };
}

// ─── YGOPRODeck (Yu-Gi-Oh!) ──────────────────────────────────────────────────

async function fetchYGOData(cardName) {
  const res = await fetch(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(cardName)}`
  );
  if (res.status === 400) return null;
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  const card = data.data?.[0];
  if (!card) return null;

  const p = card.card_prices?.[0] || {};
  const priceLines = [];
  const nonZero = (v) => v && v !== '0.00';
  if (nonZero(p.tcgplayer_price))  priceLines.push(`TCGPlayer: $${p.tcgplayer_price}`);
  if (nonZero(p.cardmarket_price)) priceLines.push(`Cardmarket: €${p.cardmarket_price}`);
  if (nonZero(p.ebay_price))       priceLines.push(`eBay avg: $${p.ebay_price}`);

  const recentSets = (card.card_sets || [])
    .slice(-3)
    .map(s => `${s.set_name} (${s.set_rarity})`);

  return {
    game: 'yugioh',
    name: card.name,
    type: card.type,
    race: card.race,
    archetype: card.archetype,
    priceLines: priceLines.length ? priceLines : null,
    recentSets: recentSets.length ? recentSets : null,
    imageUrl: card.card_images?.[0]?.image_url,
  };
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
  if (cardData.euTrend) lines.push(`  • ${cardData.euTrend}`);
  if (cardData.jpPriceLine) lines.push('', `JP PRICE: ${cardData.jpPriceLine}`);
  if (cardData.trend30d) lines.push(`30-day trend: ${cardData.trend30d}`);

  if (cardData.legalFormats?.length) {
    lines.push(`Legal in: ${cardData.legalFormats.join(', ')}`);
  }

  lines.push('=== END PRE-FETCHED DATA ===');
  return lines.join('\n');
}
