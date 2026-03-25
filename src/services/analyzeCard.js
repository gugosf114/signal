// ─── Card Analysis Service ───────────────────────────────────────────────────
// Calls Claude with web_search tool to gather real-time signal data
// for a given trading card across English and Japanese sources.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are a trading card market analyst. Given a card name and game (pokemon/yugioh/mtg), search BOTH English AND Japanese sources to gather intelligence signals.

Search strategy:
- EN sources: TCGPlayer, eBay sold listings, Reddit, YouTube, tournament results
- JP sources: Mercari JP (メルカリ), Japanese Twitter/X, Japanese YouTube, Rakuten
- For Japanese searches, use the card's Japanese name when possible

Return ONLY valid JSON (no markdown, no code fences) in this exact structure:
{
  "card_name": "exact card name",
  "game": "pokemon|yugioh|mtg",
  "prices": {
    "en_price": "$X.XX (source)",
    "jp_price": "¥X,XXX / ~$X.XX (source)",
    "jp_en_gap": "JP is X% cheaper/more expensive than EN",
    "trend_30d": "Rising/Stable/Falling — brief reason",
    "signal_vs_market": "Agree/Disagree/Unclear — one sentence why"
  },
  "signals": [
    {
      "key": "creator",
      "level": 1-5,
      "detail": "specific evidence found"
    },
    {
      "key": "community",
      "level": 1-5,
      "detail": "specific evidence found"
    },
    {
      "key": "ip_momentum",
      "level": 1-5,
      "detail": "specific evidence found"
    },
    {
      "key": "editorial",
      "level": 1-5,
      "detail": "specific evidence found"
    },
    {
      "key": "competitive",
      "level": 1-5,
      "detail": "specific evidence found"
    },
    {
      "key": "scarcity",
      "level": 1-5,
      "detail": "specific evidence found"
    },
    {
      "key": "jp_price",
      "level": 1-5,
      "detail": "specific evidence about JP vs EN pricing"
    },
    {
      "key": "jp_hype",
      "level": 1-5,
      "detail": "specific evidence from JP social media"
    },
    {
      "key": "jp_release",
      "level": 1-5,
      "detail": "JP release date vs EN, time window info"
    }
  ],
  "summary": "One sentence overall assessment"
}

Level guide: 1=minimal/none, 2=low, 3=moderate, 4=high, 5=extreme/unprecedented
Be specific with evidence. Cite actual videos, posts, prices, tournament placements when found.`;

export async function analyzeCard(cardName, game = null) {
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
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 10,
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

  // Extract text content from the response
  const textBlock = result.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('No text response from API');
  }

  // Parse the JSON from the response — handle possible markdown fences
  let jsonStr = textBlock.text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try to extract JSON object from the text
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }
    throw new Error('Failed to parse signal data from API response');
  }
}
