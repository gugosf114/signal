// ─── Catalyst Radar ───────────────────────────────────────────────────────────
// Pre-fetches structured catalyst data that feeds jp_release, competitive, and
// scarcity signals — without burning a web_search. All sources are free/public.
//
//   MTG   → Scryfall: card legality + Reserved List + upcoming sets
//   YGO   → YGOPRODeck: current TCG/OCG ban status
//   Pokémon → TCG API: all existing prints (scarcity) + upcoming EN sets

import { fetchWithTimeout } from './http.js';

// ─── MTG / Scryfall ──────────────────────────────────────────────────────────

async function scryfallCard(cardName) {
  const res = await fetchWithTimeout(
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
  );
  if (!res.ok) return null;
  const j = await res.json();
  if (j.object === 'error') return null;

  const legal = j.legalities || {};
  const formats = Object.entries(legal)
    .filter(([, v]) => v === 'legal')
    .map(([f]) => f);
  const banned = Object.entries(legal)
    .filter(([, v]) => v === 'banned')
    .map(([f]) => f);
  const restricted = Object.entries(legal)
    .filter(([, v]) => v === 'restricted')
    .map(([f]) => f);

  return {
    name: j.name,
    set: j.set_name,
    released: j.released_at,
    rarity: j.rarity,
    reserved: j.reserved || false,
    reprint: j.reprint || false,
    prints_search_uri: j.prints_search_uri,
    formats_legal: formats,
    formats_banned: banned,
    formats_restricted: restricted,
    edhrec_rank: j.edhrec_rank || null,
  };
}

async function scryfallUpcomingSets() {
  const res = await fetchWithTimeout('https://api.scryfall.com/sets');
  if (!res.ok) return null;
  const j = await res.json();
  const today = new Date().toISOString().slice(0, 10);
  return (j.data || [])
    .filter((s) => s.released_at > today && !s.digital && s.set_type !== 'token')
    .slice(0, 6)
    .map((s) => ({ name: s.name, code: s.code, date: s.released_at, type: s.set_type }));
}

async function scryfallPrintCount(printsUri) {
  if (!printsUri) return null;
  const res = await fetchWithTimeout(printsUri + '&unique=prints');
  if (!res.ok) return null;
  const j = await res.json();
  return j.total_cards || null;
}

// ─── Yu-Gi-Oh! / YGOPRODeck ─────────────────────────────────────────────────

async function ygoBanlist(cardName) {
  const res = await fetchWithTimeout(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(cardName)}&banlist_info=yes`
  );
  if (!res.ok) return null;
  const j = await res.json();
  const card = j.data?.[0];
  if (!card) return null;
  return {
    ban_tcg: card.banlist_info?.ban_tcg || 'Unlimited',
    ban_ocg: card.banlist_info?.ban_ocg || 'Unlimited',
    type: card.type,
    archetype: card.archetype || null,
  };
}

// ─── Pokémon / TCG API ───────────────────────────────────────────────────────

async function pokemonCardPrints(cardName) {
  const q = `name:"${cardName}"`;
  const res = await fetchWithTimeout(
    `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&select=id,name,set,rarity,number&pageSize=50`
  );
  if (!res.ok) return null;
  const j = await res.json();
  const cards = (j.data || []).map((c) => ({
    id: c.id,
    set: c.set?.name,
    series: c.set?.series,
    released: c.set?.releaseDate,
    rarity: c.rarity,
    number: c.number,
  }));
  return cards.length ? { total_prints: j.totalCount || cards.length, prints: cards } : null;
}

async function pokemonUpcomingSets() {
  const res = await fetchWithTimeout(
    'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=20'
  );
  if (!res.ok) return null;
  const j = await res.json();
  const today = new Date().toISOString().slice(0, 10);
  return {
    upcoming: (j.data || [])
      .filter((s) => s.releaseDate > today)
      .slice(0, 5)
      .map((s) => ({ name: s.name, date: s.releaseDate, series: s.series })),
    recent: (j.data || [])
      .filter((s) => s.releaseDate <= today)
      .slice(0, 3)
      .map((s) => ({ name: s.name, date: s.releaseDate, series: s.series })),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchCatalysts(cardName, game) {
  const g = (game || '').toLowerCase();
  if (!g) return null; // game unknown — skip; game resolves from cardData before wiring in

  if (g === 'mtg') {
    const [card, upcoming] = await Promise.all([
      scryfallCard(cardName).catch(() => null),
      scryfallUpcomingSets().catch(() => null),
    ]);
    const printCount = card?.prints_search_uri
      ? await scryfallPrintCount(card.prints_search_uri).catch(() => null)
      : null;
    if (!card && !upcoming) return null;
    return { game: 'mtg', card: card ? { ...card, print_count: printCount } : null, upcoming };
  }

  if (g === 'yugioh') {
    const ban = await ygoBanlist(cardName).catch(() => null);
    return ban ? { game: 'yugioh', ban } : null;
  }

  if (g === 'pokemon') {
    const [prints, sets] = await Promise.all([
      pokemonCardPrints(cardName).catch(() => null),
      pokemonUpcomingSets().catch(() => null),
    ]);
    if (!prints && !sets) return null;
    return { game: 'pokemon', prints, sets };
  }

  return null;
}

// ─── Prompt block ─────────────────────────────────────────────────────────────

export function catalystBlock(data) {
  if (!data) return null;
  const lines = [
    '=== CATALYST CONTEXT (pre-fetched — use for competitive/scarcity/jp_release; do NOT re-search these) ===',
  ];

  if (data.game === 'mtg' && data.card) {
    const c = data.card;
    lines.push(`Card: ${c.name} | Set: ${c.set} (${c.released}) | Rarity: ${c.rarity}`);
    if (c.reserved) lines.push('RESERVED LIST: Yes — Wizards of the Coast policy says this card will not be reprinted in a functionally identical form. This is company policy, not law.');
    else lines.push(`Reprint: ${c.reprint ? 'Yes' : 'No'} | Catalogue printing entries: ${c.print_count ?? 'unknown'} (entry count is not print quantity)`);
    if (c.formats_banned.length) lines.push(`Banned in: ${c.formats_banned.join(', ')}`);
    if (c.formats_restricted.length) lines.push(`Restricted in: ${c.formats_restricted.join(', ')}`);
    if (c.formats_legal.length) lines.push(`Legal in: ${c.formats_legal.join(', ')}`);
    if (c.edhrec_rank) lines.push(`EDHREC rank: #${c.edhrec_rank} (deck-list popularity, not purchase demand)`);
    if (data.upcoming?.length) {
      lines.push('Upcoming MTG sets (EN):');
      for (const s of data.upcoming) lines.push(`  ${s.date} — ${s.name} (${s.type})`);
    }
  }

  if (data.game === 'yugioh' && data.ban) {
    const b = data.ban;
    lines.push(`TCG ban status: ${b.ban_tcg} | OCG ban status: ${b.ban_ocg}`);
    if (b.archetype) lines.push(`Archetype: ${b.archetype}`);
    const isBanned = b.ban_tcg === 'Banned';
    const isLimited = b.ban_tcg === 'Limited';
    if (isBanned) lines.push('BANNED (TCG) — cannot be used in that ruleset; this does not prove market demand.');
    else if (isLimited) lines.push('LIMITED to 1 in the TCG ruleset; this does not prove market demand or supply.');
    else if (b.ban_tcg === 'Semi-Limited') lines.push('SEMI-LIMITED (max 2) in the TCG ruleset.');
    else lines.push('Unlimited in the TCG ruleset; current play rate was not measured here.');
  }

  if (data.game === 'pokemon') {
    if (data.prints) {
      const p = data.prints;
      lines.push(`Catalogue printing entries found: ${p.total_prints}. This counts catalogue rows, not copies printed, supply, or scarcity.`);
      const bySet = p.prints.slice(0, 5).map((c) => `${c.set} (${c.released || '?'})`).join(', ');
      lines.push(`Sets: ${bySet}${p.total_prints > 5 ? ` + ${p.total_prints - 5} more` : ''}`);
    }
    if (data.sets) {
      if (data.sets.upcoming?.length) {
        lines.push('Upcoming Pokémon EN sets:');
        for (const s of data.sets.upcoming) lines.push(`  ${s.date} — ${s.name} (${s.series})`);
      }
      if (data.sets.recent?.length) {
        lines.push(`Most recent EN sets: ${data.sets.recent.map((s) => s.name).join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}
