// Camera-based card identification.
// Capture a photo of any TCG card (Pokemon / MTG / Yu-Gi-Oh!), send the image
// to Anthropic's vision endpoint, and get back the card's name + game so we
// can feed the existing analyzeCard pipeline.
//
// Uses the same VITE_ANTHROPIC_API_KEY already wired for text scans — no
// extra credentials, no new plugin. The browser's file input handles camera
// capture (`capture="environment"`), which on Android opens the camera app
// directly inside the Capacitor WebView.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const SYSTEM = `You are a trading card identifier. The user shows you a photo of a TCG card and you must identify it.

Output strict JSON only — no markdown, no prose. Schema:
{
  "name": "<exact card name as printed>",
  "game": "pokemon" | "yugioh" | "mtg" | null,
  "set": "<set name or null>",
  "number": "<collector number like 199/198 or null>",
  "confidence": "high" | "medium" | "low",
  "notes": "<one short sentence if confidence < high, else empty>"
}

Rules:
- name: the exact card name printed on the card. For Pokemon: include suffixes like " ex", " V", " VMAX", " VSTAR", " GX". For Yu-Gi-Oh: include archetype prefixes (e.g. "Snake-Eye Ash"). For MTG: include subtitles after the comma (e.g. "Atraxa, Grand Unifier").
- game: pokemon if a Pokémon energy symbol or Pokéball is visible; yugioh if a Yu-Gi-Oh card frame (eye-of-Wadjet back, Synchro/Xyz/Link frames); mtg if Magic mana costs or planeswalker icons. null if you can't tell.
- set: the printed set name or set code (e.g. "Prismatic Evolutions", "PRE", "MOM", "LOB").
- number: the collector number printed on the card (e.g. "199/198" or "EN001").
- confidence: high only if you can read the card name clearly. medium if name is partially obscured but inferable. low otherwise.
- If the image is not a TCG card or is unreadable, return name "" and confidence "low" with a notes sentence explaining what you saw.
- Do NOT fabricate. If unsure, leave a field null and lower the confidence.`;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // dataURL like "data:image/jpeg;base64,...." — strip the prefix
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function pickMediaType(file) {
  if (!file?.type) return 'image/jpeg';
  if (file.type === 'image/jpeg' || file.type === 'image/png' ||
      file.type === 'image/webp' || file.type === 'image/gif') return file.type;
  return 'image/jpeg';
}

export async function scanCardImage(file, opts = {}) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY. Create a .env.local file with your API key.');
  }
  if (!file) throw new Error('No image provided.');

  const base64 = await fileToBase64(file);
  const mediaType = pickMediaType(file);

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
      max_tokens: 600,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: 'Identify this trading card.' },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vision API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const result = await response.json();
  const text = (result.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  if (!text) throw new Error('Vision API returned no text. Try a clearer photo.');

  const parsed = tryParse(text);
  if (!parsed) throw new Error('Could not parse card identification. Try a clearer photo.');

  if (!parsed.name) {
    const reason = parsed.notes || 'No card name detected.';
    throw new Error(`Couldn't identify a card — ${reason}`);
  }

  return parsed;
}

function tryParse(text) {
  // Direct
  try { return JSON.parse(text); } catch {}
  // Extract first {...} block
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}
