// ─── Card Analysis Service ───────────────────────────────────────────────────
// Calls Claude with web_search tool to gather real-time signal data
// for a given trading card across English and Japanese sources.
//
// Returns structured citations per signal. URLs are filtered against
// the actual web_search tool results — Claude cannot hallucinate sources.

import { creatorListForPrompt } from '../config/creators';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

function buildSystemPrompt(game) {
  // Curated creator directory injected into the prompt so the model
  // covers the right voices instead of picking 1-2 obvious names.
  const creatorBlocks = game
    ? `CURATED CREATOR DIRECTORY for ${game.toUpperCase()}:\n${creatorListForPrompt(game)}`
    : `CURATED CREATOR DIRECTORIES (resolve game first, then prioritize that list):\n\nPOKEMON:\n${creatorListForPrompt('pokemon')}\n\nMTG:\n${creatorListForPrompt('mtg')}\n\nYUGIOH:\n${creatorListForPrompt('yugioh')}`;

  return `You are a trading card market analyst. Given a card name and game (pokemon/yugioh/mtg), search BOTH English AND Japanese sources to gather intelligence signals.

Search strategy:
- EN: TCGPlayer, eBay sold listings, Reddit (r/PokemonTCG, r/yugioh, r/mtgfinance), YouTube channels, tournaments (Limitless), editorials (PokeBeach, TCGFish, MTGGoldfish)
- JP: Mercari JP, Yahoo Auctions JP, Rakuten, Japanese Twitter/X, Japanese YouTube, JP set release calendars
- Use the card's Japanese name for JP queries when possible

Output strict JSON only — no markdown, no code fences, no prose before or after.

ENUMS (use these exact lowercase strings):
- game: pokemon | yugioh | mtg
- signal key: creator | community | ip_momentum | editorial | competitive | scarcity | jp_price | jp_hype | jp_release
- source type: youtube | tournament | reddit | twitter | marketplace_en | marketplace_jp | editorial | population_report | other
- implication: up | down | neutral

CONCRETE EXAMPLE of a single signal entry:
{
  "key": "creator",
  "level": 4,
  "detail": "Strong coverage from established TCG channels in past 30 days.",
  "sources": [
    {
      "type": "youtube",
      "source": "TCG Protectors",
      "title": "Mega Charizard X ex Review — Most Hyped Card of 2026",
      "date": "2026-04-15",
      "summary": "12-minute deep dive, predicts $200+ in 6 months. 450k subs.",
      "implication": "up",
      "url": "https://www.youtube.com/watch?v=abc123"
    }
  ]
}

FULL OUTPUT SHAPE:
{
  "card_name": "...",
  "game": "...",
  "prices": {
    "en_price": "...",
    "jp_price": "...",
    "jp_en_gap": "...",
    "trend_30d": "...",
    "signal_vs_market": "..."
  },
  "signals": [ /* exactly 9 entries, one per signal key */ ],
  "summary": "..."
}

RULES:
- Every signal key must appear exactly once in the signals[] array.
- Every "level" is an integer 1-5 (1=minimal, 5=extreme).
- Every "url" MUST be a URL you actually visited via web_search. NEVER invent URLs.
- If a signal has no real sources, set "sources": [] and score the level based on what you DID find. Empty is better than fake.
- Aim for 4-7 sources per signal where evidence exists. Don't pad with weak sources.
- Keep "detail" to ONE sentence. Keep "summary" fields to 1-2 sentences. Be terse — the JSON has a hard size limit.

CREATOR COVERAGE — CRITICAL:
${creatorBlocks}

For "creator" signal: you MUST attempt to find recent (≤90 day) coverage from EACH of the curated EN creators above. Hits go in sources[]. Explicit silences (creator checked, no recent coverage) ALSO matter — surface those in the "detail" field as "no recent coverage from [Creator A], [Creator B]". Aim for 5-8 creator citations. For every YouTube source include: subscriber count in audience field (e.g. "1.6M subs"), and video view count when visible (e.g. "284k views"). These stats are what users need to gauge signal strength.

For "jp_hype" signal: cover the JP creators list when game has one.

For source.reach — populate with the curated tier (T1/T2/T3) when the creator is on the directory. Use your best judgment for non-curated creators.

For source.audience — populate with verifiable audience info when the search result surfaces it (subscriber count, post upvotes, video views). Examples: "450k subs", "12k upvotes", "8.5M views". Leave null if unknown — never guess.

EXTRA SOURCE FIELDS (add to every source object):
{
  ...,
  "reach": "T1 | T2 | T3 | unknown",
  "audience": "string with verifiable audience metric, or null"
}`;
}

export async function analyzeCard(cardName, game = null, opts = {}) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing VITE_ANTHROPIC_API_KEY. Create a .env.local file with your API key.'
    );
  }

  const userMessage = game
    ? `Analyze the ${game} card: "${cardName}". Search both English and Japanese markets.`
    : `Analyze the trading card: "${cardName}". Determine which game it's from (Pokemon, Yu-Gi-Oh, or MTG), then search both English and Japanese markets.`;

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
      model: MODEL,
      max_tokens: 32768,
      system: buildSystemPrompt(game),
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          // Leave headroom for final JSON synthesis after searches.
          // Too high = model exhausts budget on tool calls and never emits text.
          max_uses: 16,
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const result = await response.json();

  // Build the set of URLs Claude actually retrieved via web_search.
  // Anything Claude cites NOT in this set is hallucinated and gets dropped.
  const realUrls = extractRealUrls(result.content || []);

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

  // Try each text block from last to first — JSON is almost always in the final one
  for (let i = textBlocks.length - 1; i >= 0; i--) {
    const parsed = tryParseSignalJSON(textBlocks[i]);
    if (parsed) return filterHallucinatedSources(parsed, realUrls);
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

// ─── URL Verification ────────────────────────────────────────────────────────
// Extract every URL the model actually retrieved via web_search.
// Used to filter out hallucinated source URLs.

function extractRealUrls(contentBlocks) {
  const urls = new Set();
  for (const block of contentBlocks) {
    if (block.type !== 'web_search_tool_result') continue;
    const items = Array.isArray(block.content) ? block.content : [];
    for (const item of items) {
      if (item.type === 'web_search_result' && item.url) {
        urls.add(normalizeUrl(item.url));
      }
    }
  }
  return urls;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return url.replace(/\/+$/, '').toLowerCase();
  }
}

// YouTube/youtu.be video ID extractor — duplicated from brandIcons.jsx so this
// module stays JSX-import-free.
const YT_ID_PATTERNS = [
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
];

function ytId(url) {
  if (!url) return null;
  for (const p of YT_ID_PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function urlIsReal(url, realUrls) {
  if (!url) return false;

  // 1. Exact normalized match — strongest signal
  if (realUrls.has(normalizeUrl(url))) return true;

  // 2. Host-aware fallback for cases where the model visited a parent page
  //    and cited a deeper one. Strict by host class to prevent path-prefix
  //    holes (e.g. '/watch' matching '/watch?v=ANYTHING' since URL.pathname
  //    excludes the query string).
  let a;
  try { a = new URL(url); } catch { return false; }

  // YouTube: match by video ID, not pathname. One real /watch URL must NOT
  // unlock unlimited fabricated /watch?v=X citations.
  if (a.host.endsWith('youtube.com') || a.host.endsWith('youtu.be')) {
    const id = ytId(url);
    if (!id) return false;
    for (const real of realUrls) {
      if (ytId(real) === id) return true;
    }
    return false;
  }

  // Other hosts: accept only true sub-paths of a real URL. Require a slash
  // boundary so '/products/foo' doesn't accept '/products-fake'. Reject
  // bare-host roots so '/' doesn't pass everything on the host.
  for (const real of realUrls) {
    let b;
    try { b = new URL(real); } catch { continue; }
    if (a.host.toLowerCase() !== b.host.toLowerCase()) continue;
    if (b.pathname.length <= 1) continue; // '/' or '' — too permissive
    if (a.pathname === b.pathname) return true;
    if (a.pathname.startsWith(b.pathname + '/')) return true;
  }
  return false;
}

function filterHallucinatedSources(parsed, realUrls) {
  if (!Array.isArray(parsed.signals)) {
    parsed.signals = [];
    parsed._truncated = true;
    return parsed;
  }
  const droppedByKey = {};
  let totalDropped = 0;
  for (const signal of parsed.signals) {
    if (!Array.isArray(signal.sources)) {
      signal.sources = [];
      continue;
    }
    const before = signal.sources;
    signal.sources = before.filter((s) => urlIsReal(s.url, realUrls));
    const drops = before.filter((s) => !urlIsReal(s.url, realUrls)).map((s) => s.url);
    if (drops.length) {
      droppedByKey[signal.key || '?'] = drops;
      totalDropped += drops.length;
    }
  }
  if (totalDropped > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[signal] dropped ${totalDropped} source URL(s) not in web_search results:`,
      droppedByKey
    );
  }
  return parsed;
}

// ─── JSON parsing with truncation repair ─────────────────────────────────────

function tryParseSignalJSON(text) {
  if (!text) return null;

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Fast path
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Find the largest JSON object in the text, balanced or not
  const extracted = extractJsonObject(cleaned);
  if (!extracted) return null;

  const fromExtracted = tryParse(extracted);
  if (fromExtracted) return fromExtracted;

  // Repair attempt: balance braces, drop trailing partial member.
  // If repair succeeds, mark the result so the UI can surface "partial".
  const repaired = repairTruncatedJson(extracted);
  if (repaired && repaired !== extracted) {
    const fromRepaired = tryParse(repaired);
    if (fromRepaired) {
      // eslint-disable-next-line no-console
      console.warn(
        `[signal] truncated JSON repaired: ${extracted.length} → ${repaired.length} chars`
      );
      fromRepaired._truncated = true;
      return fromRepaired;
    }
  }

  return null;
}

function tryParse(s) {
  try {
    const data = JSON.parse(s);
    if (data && (data.signals || data.card_name)) return data;
  } catch {}
  return null;
}

function extractJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"' && !inString) { inString = true; continue; }
    if (c === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.substring(start, i + 1);
    }
  }
  // Unbalanced — return what we got, repair will handle
  return text.substring(start);
}

function repairTruncatedJson(s) {
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escape = false;
  let lastSafe = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"' && !inString) { inString = true; continue; }
    if (c === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (c === '{') braceDepth++;
    else if (c === '}') braceDepth--;
    else if (c === '[') bracketDepth++;
    else if (c === ']') bracketDepth--;
    // Mark a safe truncation point right after a complete member terminator
    if (!inString && (c === '}' || c === ']')) {
      lastSafe = i;
    }
  }

  if (braceDepth === 0 && bracketDepth === 0 && !inString) return s;

  // No safe truncation point ever found — bail rather than emit a guaranteed-
  // broken string. (`> 0` was wrong: it conflated "no safe point" with
  // "safe at index 0".)
  if (lastSafe < 0) return null;

  // Trim to last safe close, then re-balance
  let trimmed = s.substring(0, lastSafe + 1);
  trimmed = trimmed.replace(/,\s*$/, '');

  // Recount on the trimmed string
  let bd = 0, kd = 0, inS = false, esc = false;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"' && !inS) { inS = true; continue; }
    if (c === '"' && inS) { inS = false; continue; }
    if (inS) continue;
    if (c === '{') bd++;
    else if (c === '}') bd--;
    else if (c === '[') kd++;
    else if (c === ']') kd--;
  }
  while (kd > 0) { trimmed += ']'; kd--; }
  while (bd > 0) { trimmed += '}'; bd--; }
  return trimmed;
}
