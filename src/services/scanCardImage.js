// Camera-based card identification.
// Capture a photo of any TCG card (Pokemon / MTG / Yu-Gi-Oh!), send the image
// to Anthropic's vision endpoint, and get back the card's name + game so we
// can feed the existing analyzeCard pipeline.
//
// Uses the same VITE_ANTHROPIC_API_KEY already wired for text scans — no
// extra credentials, no new plugin. The browser's file input handles camera
// capture (`capture="environment"`), which on Android opens the camera app
// directly inside the Capacitor WebView.

import { fetchWithTimeout } from './http.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
// Haiku handles reading a card's name/set/number off a clear photo just as well
// as Sonnet at ~1/3 the cost — the heavy synthesis stays on Sonnet in analyzeCard.
const MODEL = 'claude-haiku-4-5';

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

// ─── Getting the photo small enough to send ──────────────────────────────────
// A phone camera hands back a 12-50MP JPEG: 3-12MB on disk, a third bigger
// again once base64'd. The API takes 5MB per image, and downscales anything
// over ~1568px on its own end anyway — so a full-size photo is rejected outright
// or pays for pixels nobody looks at. Resizing here is what makes the camera
// work on a real phone; it was tested with laptop-sized files and shipped
// without it.
const MAX_EDGE = 1568;
const MAX_BASE64_BYTES = 4.5 * 1024 * 1024;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException('Image scan cancelled.', 'AbortError');
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path — some WebView builds refuse blobs here.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

async function toSendableBase64(file, signal) {
  abortIfNeeded(signal);
  const bmp = await decodeImage(file);
  abortIfNeeded(signal);
  const w = bmp.width || bmp.naturalWidth;
  const h = bmp.height || bmp.naturalHeight;
  if (!w || !h) throw new Error('decode failed');

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  abortIfNeeded(signal);

  // Quality steps down only if a card photo somehow still lands over the wire
  // limit — at 1568px it never should.
  for (const q of [0.85, 0.7, 0.55]) {
    const dataUrl = canvas.toDataURL('image/jpeg', q);
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (b64.length <= MAX_BASE64_BYTES) return b64;
  }
  throw new Error('too big');
}

export async function scanCardImage(file, opts = {}) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY. Create a .env.local file with your API key.');
  }
  if (!file) throw new Error('No image provided.');
  if (Number(file.size) > MAX_INPUT_BYTES) throw new Error('That photo is too large to open. Use a smaller picture.');
  abortIfNeeded(opts.signal);

  let base64;
  const mediaType = 'image/jpeg';
  try {
    base64 = await toSendableBase64(file, opts.signal);
  } catch {
    // Couldn't decode it here. HEIC is the usual reason — Samsung's "High
    // efficiency" picture format — and the API can't read it either, so say so
    // rather than letting it come back as an opaque 400.
    const looksHeic = /heic|heif/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');
    if (looksHeic) {
      throw new Error(
        'That photo is in HEIC format, which can\'t be read. In the camera app: Settings → Picture format → JPEG.'
      );
    }
    throw new Error('That image could not be safely resized. Use a JPEG or PNG screenshot of the card.');
  }

  const response = await fetchWithTimeout(API_URL, {
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
  }, 30000);

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

  const clean = validateCardIdentification(parsed);
  if (!clean.name) {
    const reason = parsed.notes || 'No card name detected.';
    throw new Error(`Couldn't identify a card — ${reason}`);
  }

  if (clean.confidence === 'low') throw new Error(`Couldn't identify the card with enough confidence — ${clean.notes || 'try a clearer photo'}`);
  return clean;
}

export function validateCardIdentification(value) {
  const input = value && typeof value === 'object' ? value : {};
  const cleanText = (field, max) => typeof field === 'string'
    ? field.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
  const game = ['pokemon', 'yugioh', 'mtg'].includes(input.game) ? input.game : null;
  const confidence = ['high', 'medium', 'low'].includes(input.confidence) ? input.confidence : 'low';
  return {
    name: cleanText(input.name, 180),
    game,
    set: cleanText(input.set, 160) || null,
    number: cleanText(input.number, 80) || null,
    confidence,
    notes: cleanText(input.notes, 240),
  };
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
