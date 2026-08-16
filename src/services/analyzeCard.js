// ─── Card Analysis Service ───────────────────────────────────────────────────
// Calls Claude with web_search tool to gather real-time signal data
// for a given trading card across English and Japanese sources.
//
// Returns structured citations per signal. URLs are filtered against
// the actual web_search tool results — Claude cannot hallucinate sources.

import { creatorListForPrompt } from '../config/creators';
import { fetchCardData, buildCardDataBlock } from './fetchCardData';
import { toPrinting } from './printing';
import { fetchCommunity, communityBlock } from './fetchCommunity';
import { fetchCreators, creatorsBlock } from './fetchCreators';
import { fetchEbayListings, ebayBlock } from './fetchEbayListings';
import { fetchJpSignal, jpBlock } from './fetchJpSignal';
import { fetchCatalysts, catalystBlock } from './fetchCatalysts';
import {
  extractRealUrls,
  collectPrefetchUrls,
  filterHallucinatedSources,
} from './citations';
import { tryParseSignalJSON } from './jsonRepair';

const API_URL = 'https://api.anthropic.com/v1/messages';

// Two-tier model selection. When the pre-fetch has already answered everything
// (MTG resolves with 0 web_searches), the model is only judging supplied facts
// and emitting JSON — work Haiku handles at ~1/3 the cost. Sonnet is reserved
// for scans that still need live search and cross-source synthesis.
// Flip FAST_MODEL to SMART_MODEL to disable the tiering in one edit.
const SMART_MODEL = 'claude-sonnet-4-6';
const FAST_MODEL = 'claude-haiku-4-5';

function buildSystemPrompt(game) {
  // Curated creator directory injected into the prompt so the model
  // covers the right voices instead of picking 1-2 obvious names.
  const creatorBlocks = game
    ? `CURATED CREATOR DIRECTORY for ${game.toUpperCase()}:\n${creatorListForPrompt(game)}`
    : `CURATED CREATOR DIRECTORIES (resolve game first, then prioritize that list):\n\nPOKEMON:\n${creatorListForPrompt('pokemon')}\n\nMTG:\n${creatorListForPrompt('mtg')}\n\nYUGIOH:\n${creatorListForPrompt('yugioh')}`;

  return `You are a trading card market analyst. Search EN + JP sources to score 9 signals on the given card. Output strict JSON only — no markdown, no fences, no prose.

EFFICIENCY: budget is tight. One web_search per signal max. If pre-fetched EN price data is in the user message, DO NOT re-search EN prices. If a CATALYST CONTEXT block is present, use it directly for competitive/scarcity/jp_release — do NOT re-search ban status, legality, set dates, or print counts.

ENUMS (exact lowercase):
- game: pokemon | yugioh | mtg
- signal key: creator | community | ip_momentum | editorial | competitive | scarcity | jp_hype | jp_release
- source.type: youtube | tournament | reddit | twitter | marketplace_en | marketplace_jp | editorial | population_report | other
- source.implication: up | down | neutral
- source.reach: T1 | T2 | T3 | unknown

OUTPUT SHAPE:
{
  "card_name": "", "game": "",
  "prices": { "en_price": "", "trend_30d": "", "signal_vs_market": "" },
  "ebay_listings": {
    "buy_it_now": [ { "title": "", "price_usd": 0, "condition": "", "shipping": "", "seller": "", "url": "" } /* 2 */ ],
    "auction":    [ { "title": "", "current_bid_usd": 0, "condition": "", "bid_count": 0, "time_remaining": "", "url": "" } /* 1, omit if no live auction */ ]
  },
  "grading_roi": {
    "raw_price_usd": 0,
    "psa10_est_usd": 0,
    "grading_cost_usd": 25,
    "net_roi_usd": 0,
    "net_roi_pct": 0,
    "verdict": "worth_grading | marginal | not_worth_grading | insufficient_data",
    "confidence": "high | medium | low | insufficient_data",
    "note": "one sentence — e.g. Reserved List card, PSA 10 pop is low, or card grades well due to black border"
  },
  "signals": [
    /* exactly 8 — one per signal key. Each: { "key", "level" (1-5 int), "detail" (1 sentence), "sources": [ { "type","source","title","date","summary","implication","url","reach","audience" } ] } */
  ],
  "summary": ""
}

RULES:
- Every cited "url" MUST come from a web_search you actually ran OR from a pre-fetched block above. Never invent. No real source → "sources": [] (empty > fake).
- EXACTLY 1 source per signal (the single strongest); [] if none. Keeps the response small and fast.
- Detail = 1 short sentence. Summary = 1 sentence. Be terse.
- eBay listings: include ONLY if a pre-fetched "EBAY LISTINGS" block is provided (copy those). Otherwise both arrays empty. NEVER invent eBay listings.
- source.audience = verifiable metric only (e.g. "450k subs", "12k upvotes", "8.5M views") or null. Never guess.

${creatorBlocks}
For "creator": top 3-4 EN creators from above (T1 first). Hits in sources[]; silences in detail.
For "jp_hype": JP creators from the directory when present.

GRADING ROI:
- raw_price_usd: use en_price (numeric, strip $)
- psa10_est_usd: your best estimate of PSA 10 market value — use your knowledge of this card's graded sales; note as low confidence if uncertain
- grading_cost_usd: 25 (economy/bulk); raise to 50 if raw > $100, 150 if raw > $500
- net_roi_usd = psa10_est_usd - raw_price_usd - grading_cost_usd
- verdict: worth_grading if net > $30 AND net_roi_pct > 30%; marginal if net $10-30; not_worth_grading if net < $10 or pct < 20%; insufficient_data if price unknown
- note: one sentence on the key grading factor (pop scarcity, card condition sensitivity, border type, etc.)
- If the card has no meaningful grading market (commons, low-value cards) → insufficient_data`;
}

export async function analyzeCard(cardName, game = null, opts = {}) {
  const pin = opts.pin || null;
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing VITE_ANTHROPIC_API_KEY. Create a .env.local file with your API key.'
    );
  }

  // Pre-fetch structured data in PARALLEL — direct APIs instead of slow, sequential
  // LLM web_search. Free always: card identity + EN price (pokemontcg.io /
  // Scryfall / YGOPRODeck), Reddit (no key). Activate with keys: eBay Browse,
  // YouTube Data. Each parallel call that succeeds removes one ~5-15s
  // sequential web_search downstream.
  const [cardData, community, creators, ebay, jp, catalysts] = await Promise.all([
    fetchCardData(cardName, game, pin).catch(() => null),
    fetchCommunity(cardName, game).catch(() => null),
    fetchCreators(cardName, game).catch(() => null),
    fetchEbayListings(cardName, game).catch(() => null),
    fetchJpSignal(cardName).catch(() => null),
    fetchCatalysts(cardName, game).catch(() => null),
  ]);
  const dataBlock = buildCardDataBlock(cardData);
  const extraBlocks = [communityBlock(community), creatorsBlock(creators), ebayBlock(ebay), jpBlock(jp), catalystBlock(catalysts)].filter(Boolean);
  const hasPreFetch = !!dataBlock || extraBlocks.length > 0;

  // A pinned printing must be named in the prompt, or the model's own searches
  // drift back to the most famous version of the card — which is exactly the
  // ambiguity the suggestion dropdown exists to remove.
  const printing = pin
    ? [pin.setName, pin.number ? `#${pin.number}` : null].filter(Boolean).join(' ')
    : (cardData && cardData.setName
        ? [cardData.setName, cardData.number ? `#${cardData.number}` : null].filter(Boolean).join(' ')
        : '');
  const exact = printing ? ` — the ${printing} printing specifically` : '';

  const baseMessage = game
    ? `Analyze the ${game} card: "${cardName}"${exact}. Search both English and Japanese markets.`
    : `Analyze the trading card: "${cardName}"${exact}. Determine which game it's from (Pokemon, Yu-Gi-Oh, or MTG), then search both English and Japanese markets.`;

  // Each web_search is 5-15s of SEQUENTIAL wall clock — the dominant cost. Only
  // search for what the parallel pre-fetch can't cover, and gate by game so we
  // never pay for irrelevant searches (e.g. JP/tournament for an MTG card).
  const resolvedGame = (game || cardData?.game || '').toLowerCase();
  const searchTargets = [];
  // The JP yen price is no longer scored or displayed. It was the only part of
  // the Japan angle that required a live web_search — Mercari JP and Yahoo
  // Auctions JP have no free API — and it frequently came back N/A because the
  // card has no direct OCG printing. JP buzz (YouTube, region JP) and JP release
  // timing still come from the free pre-fetch, so the Japan section keeps its two
  // leading indicators at zero search cost.
  // Tournament/competitive: only search if we don't already have structured data.
  // YGO banlist and MTG legality come from catalyst pre-fetch. Pokémon needs Limitless.
  if (resolvedGame === 'pokemon')
    searchTargets.push('Tournament — Limitless usage / ban list');
  else if ((resolvedGame === 'yugioh' || resolvedGame === 'mtg') && !catalysts)
    searchTargets.push('Tournament / competitive usage + ban status');
  // Only sweep community+creators if BOTH direct pulls came back empty.
  if (!community && !creators)
    searchTargets.push('Recent community + creator coverage — Reddit / YouTube');
  // eBay is no longer searched — it comes only from the eBay Browse pre-fetch (keyed).

  const maxSearches = searchTargets.length; // 0 for MTG and Yu-Gi-Oh, 1 for Pokémon

  // Every URL handed to the model in a pre-fetch block is REAL — it came from a
  // live API call we made ourselves. The citation filter below must know about
  // these or it drops every honestly-cited Reddit / YouTube / eBay / JP source,
  // since those never appear in a web_search_tool_result block.
  const prefetchUrls = collectPrefetchUrls({ cardData, community, creators, ebay, jp });

  // Haiku for pure-synthesis scans, Sonnet whenever live search is in play.
  const model = maxSearches === 0 ? FAST_MODEL : SMART_MODEL;

  const userMessage = hasPreFetch
    ? [
        baseMessage,
        ...(dataBlock ? ['', dataBlock] : []),
        ...(extraBlocks.length ? ['', extraBlocks.join('\n\n')] : []),
        '',
        maxSearches
          ? 'The blocks above are pre-fetched and REAL — use them directly, do NOT re-search them. web_search ONLY for what is missing below:'
          : 'The blocks above are pre-fetched and REAL. Score every signal from this data and your own knowledge — do NOT web_search (not needed for this card).',
        ...searchTargets.map((t, i) => `${i + 1}. ${t}`),
      ].join('\n')
    : baseMessage;

  const response = await fetch(API_URL, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      // Sonnet runs adaptive thinking, so it needs headroom above the ~4k of
      // JSON the schema produces. The Haiku path does no thinking and only has
      // to format pre-fetched facts, so 8k is ample and keeps the bill down.
      max_tokens: model === FAST_MODEL ? 8000 : 24000,
      // Adaptive thinking: the model decides how much to reason through
      // cross-signal patterns before emitting the structured 9-signal scorecard.
      // Thinking tokens are drawn from max_tokens, so max_tokens carries headroom
      // (24k) to leave room for the full JSON output and avoid truncation.
      // (Adaptive replaces the deprecated {type:'enabled',budget_tokens} form,
      //  which 400s on Opus 4.7+/Fable if the model is ever upgraded.)
      ...(model === FAST_MODEL
        ? {}
        : { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } }),
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(game),
          cache_control: { type: 'ephemeral' },
        },
      ],
      // Attach web_search ONLY when there's something left to search — a card
      // that needs no search (e.g. MTG) skips the tool entirely and just
      // synthesizes from pre-fetched data, which is far faster.
      ...(maxSearches > 0
        ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }] }
        : {}),
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const result = await response.json();

  // Build the set of URLs that provably exist: everything Claude retrieved via
  // web_search, PLUS everything we handed it in a pre-fetch block (those came
  // from our own live API calls, so they're at least as trustworthy).
  // Anything Claude cites outside this set is hallucinated and gets dropped.
  const realUrls = extractRealUrls(result.content || []);
  for (const u of prefetchUrls) realUrls.add(u);

  // Web search responses have many content blocks: text, tool_use, tool_result
  // The structured JSON is typically in the LAST text block after all searches complete.
  const textBlocks = (result.content || [])
    .filter((b) => b.type === 'text' && b.text?.trim())
    .map((b) => b.text.trim());

  if (textBlocks.length === 0) {
    // The model never produced a final text block — usually because it ran out of
    // tool budget or output tokens mid-search.
    const blockTypes = (result.content || []).map((b) => b.type);
    // eslint-disable-next-line no-console
    console.error('[signal] no text response', {
      stop_reason: result.stop_reason,
      usage: result.usage,
      block_types: blockTypes,
      block_count: blockTypes.length,
      web_search_results: blockTypes.filter((t) => t === 'web_search_tool_result').length,
      tool_uses: blockTypes.filter((t) => t === 'server_tool_use' || t === 'tool_use').length,
    });
    if (result.stop_reason === 'max_tokens') {
      throw new Error('Response exhausted token budget before finalizing. Try again — usually transient.');
    }
    if (result.stop_reason === 'tool_use') {
      throw new Error('Model paused mid-search and didn\'t produce a summary. Try again.');
    }
    throw new Error(`No text response from API (stop_reason: ${result.stop_reason || 'unknown'}). Check console for diagnostic.`);
  }

  // The exact printing this scan is about, carried back so the result page can
  // say which one it read. Without it the answer just says "Umbreon ex", and
  // the user has no way to tell whether the card they picked is the card that
  // got scanned.
  const printingInfo = toPrinting(game || cardData?.game || pin?.game, pin, cardData);

  // Try each text block from last to first — JSON is almost always in the final one
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const parsed = tryParseSignalJSON(textBlocks[i]);
    if (parsed) {
      const clean = filterHallucinatedSources(parsed, realUrls);
      if (printingInfo) clean.printing = printingInfo;
      return clean;
    }
  }

  // eslint-disable-next-line no-console
  console.error('[signal] parse failure', {
    stop_reason: result.stop_reason,
    usage: result.usage,
    blocks: (result.content || []).map((b) => b.type),
    last_text_excerpt: textBlocks[textBlocks.length - 1]?.slice(-600),
  });

  throw new Error(
    result.stop_reason === 'max_tokens'
      ? 'Response was truncated by max_tokens — try a more specific card or simpler query.'
      : 'Failed to parse signal data from API response. Check console for raw output.'
  );
}
