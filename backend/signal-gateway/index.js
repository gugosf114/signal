const crypto = require('crypto');
const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue, Timestamp } = require('@google-cloud/firestore');
const { GoogleAuth } = require('google-auth-library');

const db = new Firestore();
const REPORTS = 'signal_shared_reports_v1';
const MEASUREMENTS = 'signal_score_measurements_v1';
const LIMITS = 'signal_gateway_limits_v1';
const YUGIOH_ART = 'signal_yugioh_official_art_v1';
const REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REPORT_LEASE_MS = 3 * 60 * 1000;
const REPORT_WAIT_MS = 110 * 1000;
const REPORT_POLL_MS = 1000;
const DAILY_MODEL_CALLS = 100;
// Whole-service ceilings. The per-install cap keys on a header the caller
// chooses, so on its own it bounds nothing; these bound the day's bill.
const DAILY_GLOBAL_MODEL_CALLS = 600;
const YOUTUBE_CACHE = 'signal_youtube_cache_v1';
const YOUTUBE_CACHE_MS = 24 * 60 * 60 * 1000;
const DAILY_YOUTUBE_CALLS = 60;
// YouTube's free quota is 10,000 units a day and one search costs 100.
const DAILY_GLOBAL_YOUTUBE_CALLS = 95;
const YOUTUBE_REGIONS = new Set(['', 'US', 'JP']);
const YOUTUBE_LANGUAGES = new Set(['', 'en', 'ja']);
const YOUTUBE_ORDERS = new Set(['relevance', 'date']);
const ALLOWED_MODELS = new Set(['claude-haiku-4-5', 'claude-sonnet-4-6']);
const GEMINI_CARD_MODEL = 'gemini-3.5-flash-lite';
const VERTEX_LOCATION = 'global';
const CARD_IDENTIFIER_SYSTEM = `You are a trading card identifier. The user shows you a photo of a TCG card and you must identify it.

Output strict JSON only — no markdown, no prose. Schema:
{
  "name": "<exact card name as printed>",
  "game": "pokemon" | "yugioh" | "mtg" | null,
  "set": "<set name or null>",
  "number": "<collector number like 199/198 or null>",
  "passcode": "<Yu-Gi-Oh 8-digit lower-left card passcode, or null>",
  "rarity": "<visible printing rarity such as Starlight Rare, or null>",
  "confidence": "high" | "medium" | "low",
  "notes": "<one short sentence if confidence < high, else empty>"
}

Rules:
- Copy the exact printed name. Keep Pokemon suffixes such as ex, VMAX, and VSTAR.
- game is pokemon, yugioh, or mtg. Use null when the card frame is unclear.
- For Yu-Gi-Oh, number is the lower-right set code. passcode is the lower-left 8-digit number.
- Inspect both lower corners. Preserve every letter and digit.
- Do not infer a nearby printing. Use null for text you cannot read.
- High confidence requires a clearly read name. Never use confidence to hide an uncertain code or rarity.`;
const googleAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const CATALOGUE_RULES = new Map([
  ['api.pokemontcg.io', /^\/v2\/(?:cards|sets)(?:\/[^/]+)?$/],
  ['api.tcgdex.net', /^\/v2\/en\/(?:cards|sets)(?:\/[^/]+)?$/],
  ['api.scryfall.com', /^\/(?:cards|sets)(?:\/.*)?$/],
  ['db.ygoprodeck.com', /^\/api\/v7\/(?:cardinfo|cardsets|cardsetsinfo)\.php$/],
  // TCGplayer's per-product price history, read by its own article widgets.
  ['infinite-api.tcgplayer.com', /^\/price\/history\/\d+(?:\/detailed)?$/],
]);

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function cors(req, res) {
  res.set('Access-Control-Allow-Origin', req.get('origin') || '*');
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Signal-Install-Id');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestampMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function reportDisposition(saved, now = Date.now(), force = false) {
  if (saved?.inFlightOwner && timestampMillis(saved.inFlightUntil) > now) return 'wait';
  if (!force && saved?.rawResponse && timestampMillis(saved.expiresAt) > now) return 'cached';
  return 'claim';
}

function cachedReport(saved) {
  return {
    cached: true,
    createdAt: saved?.createdAt?.toDate?.()?.toISOString() || null,
    result: saved?.rawResponse,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeText(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function catalogueTarget(value) {
  const raw = safeText(value, 2200);
  let target;
  try {
    target = new URL(raw);
  } catch {
    throw Object.assign(new Error('Catalogue URL is invalid.'), { status: 400 });
  }
  const rule = CATALOGUE_RULES.get(target.hostname);
  if (target.protocol !== 'https:' || target.username || target.password || target.hash || !rule?.test(target.pathname)) {
    throw Object.assign(new Error('Catalogue is not allowed.'), { status: 400 });
  }
  return target.toString();
}

async function catalogueFetch(body, fetcher = fetch) {
  const target = catalogueTarget(body.url);
  const response = await fetcher(target, {
    headers: { 'user-agent': 'SignalTCG/1.0 (card market intelligence)' },
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > 6 * 1024 * 1024) {
    throw Object.assign(new Error('Catalogue reply is too large.'), { status: 502 });
  }
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {
    throw Object.assign(new Error('Catalogue returned invalid data.'), { status: 502 });
  }
  return { catalogue: true, ok: response.ok, status: response.status, data };
}

async function tcgplayerSearch(body, fetcher = fetch) {
  const query = safeText(body.query, 180);
  const setName = safeText(body.setName, 180);
  const game = safeText(body.game, 20).toLowerCase() || 'yugioh';
  const productLine = { pokemon: 'Pokemon', mtg: 'Magic', yugioh: 'YuGiOh' }[game];
  if (query.length < 2) throw Object.assign(new Error('Card name is required.'), { status: 400 });
  if (!productLine) throw Object.assign(new Error('Card game is not allowed.'), { status: 400 });
  const terms = { productLineName: [productLine] };
  if (setName) terms.setName = [setName];
  const response = await fetcher(
    `https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(query)}&isList=false`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'SignalTCG/1.0' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        algorithm: 'sales_exp_fields_synonym',
        from: 0,
        size: 50,
        filters: { term: terms, range: {}, match: {} },
        listingSearch: {
          context: { cart: {} },
          filters: {
            term: { sellerStatus: 'Live', channelId: 0 },
            range: { quantity: { gte: 1 } },
            exclude: { channelExclusion: 0 },
          },
        },
        context: { cart: {}, shippingCountry: 'US' },
        settings: { useFuzzySearch: true },
        sort: {},
      }),
    },
  );
  if (!response.ok) throw Object.assign(new Error(`TCGplayer returned ${response.status}.`), { status: 502 });
  const payload = await response.json();
  const products = (payload?.results?.[0]?.results || []).slice(0, 50).map((item) => ({
    productId: finite(item?.productId),
    productName: safeText(item?.productName, 220),
    setName: safeText(item?.setName, 180),
    number: safeText(item?.customAttributes?.number, 80),
    rarityName: safeText(item?.rarityName || item?.customAttributes?.rarityDbName, 100),
    marketPrice: finite(item?.marketPrice),
    lowestPrice: finite(item?.lowestPrice),
    medianPrice: finite(item?.medianPrice),
    releaseDate: safeText(item?.customAttributes?.releaseDate, 40),
  })).filter((item) => Number.isInteger(item.productId) && item.productId > 0 && item.productName);
  return { products };
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function rows(html) {
  return String(html || '').split(/<div class="t_row[^>]*>/i).slice(1);
}

function officialCardCid(html, cardName) {
  const wanted = String(cardName || '').trim().toLowerCase();
  for (const row of rows(html)) {
    const name = decodeHtml(row.match(/class="cnm"\s+value='([^']*)'/i)?.[1]).trim().toLowerCase();
    const cid = row.match(/class="link_value"\s+value="[^"]*cid=(\d+)/i)?.[1];
    if (name === wanted && cid) return cid;
  }
  return null;
}

function officialSetPid(html, setCode, rarity) {
  const wantedCode = String(setCode || '').trim().toUpperCase();
  const wantedRarity = String(rarity || '').trim().toLowerCase();
  let codeFallback = null;
  for (const row of rows(html)) {
    const text = decodeHtml(row.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text.toUpperCase().includes(wantedCode)) continue;
    const pid = row.match(/pid=(\d+)/i)?.[1];
    if (!pid) continue;
    codeFallback ||= pid;
    if (wantedRarity && text.toLowerCase().includes(wantedRarity)) return pid;
  }
  return codeFallback;
}

function officialSetImage(html, cardName, cid) {
  const wanted = String(cardName || '').trim().toLowerCase();
  let imageId = null;
  for (const row of rows(html)) {
    const name = decodeHtml(row.match(/class="card_name"[^>]*>\s*([^<]+)/i)?.[1]).trim().toLowerCase();
    const match = row.match(/id="card_image_(\d+)_(\d+)"/i);
    if (name === wanted && match) { imageId = { index: match[1], ciid: match[2] }; break; }
  }
  if (!imageId) return null;
  const escaped = `card_image_${imageId.index}_${imageId.ciid}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const line = String(html).match(new RegExp(`${escaped}[^\\n]*get_image\\.action\\?([^']+)`, 'i'))?.[1];
  if (!line || !String(line).includes(`cid=${cid}`)) return null;
  const query = decodeHtml(line).replace(/^type=1&/, 'type=2&');
  return `https://www.db.yugioh-card.com/yugiohdb/get_image.action?${query}`;
}

async function fetchOfficialHtml(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'SignalTCG/1.0' } });
  if (!response.ok) throw new Error(`Official Yu-Gi-Oh database returned ${response.status}.`);
  return response.text();
}

async function yugiohArt(body) {
  const cardName = safeText(body.cardName, 180);
  const setCode = safeText(body.setCode, 80).toUpperCase();
  const rarity = safeText(body.rarity, 80);
  if (!cardName || !setCode) throw new Error('Card name and set code are required.');
  const key = hash(`${cardName.toLowerCase()}::${setCode}::${rarity.toLowerCase()}`);
  const ref = db.collection(YUGIOH_ART).doc(key);
  const saved = (await ref.get()).data();
  if (saved?.imageUrl && saved?.expiresAt?.toMillis?.() > Date.now()) return { cached: true, imageUrl: saved.imageUrl };

  const root = 'https://www.db.yugioh-card.com/yugiohdb';
  const search = await fetchOfficialHtml(`${root}/card_search.action?keyword=${encodeURIComponent(cardName)}&ope=1&request_locale=en`);
  const cid = officialCardCid(search, cardName);
  if (!cid) return { cached: false, imageUrl: null };
  const detail = await fetchOfficialHtml(`${root}/card_search.action?cid=${cid}&ope=2&request_locale=en`);
  const pid = officialSetPid(detail, setCode, rarity);
  if (!pid) return { cached: false, imageUrl: null };
  const setPage = await fetchOfficialHtml(`${root}/card_search.action?ope=1&sess=1&pid=${pid}&rp=99999&request_locale=en`);
  const imageUrl = officialSetImage(setPage, cardName, cid);
  if (imageUrl) await ref.set({ cardName, setCode, rarity, cid, pid, imageUrl,
    createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000) });
  return { cached: false, imageUrl };
}

// Paid actions need the token compiled into Signal builds. Enforcement
// switches on only once SIGNAL_APP_TOKEN is set on the service, so phones on
// an older build keep working until the new build is installed.
function requireAppToken(body, expected = process.env.SIGNAL_APP_TOKEN) {
  if (!expected) return;
  if (safeText(body?.appToken, 200) !== expected) {
    throw Object.assign(new Error('This Signal build cannot use the paid gateway. Update the app.'), { status: 401 });
  }
}

function validateYoutubeBody(body) {
  const q = safeText(body?.q, 200);
  if (q.length < 2) throw Object.assign(new Error('Search text is required.'), { status: 400 });
  const regionCode = safeText(body?.regionCode, 2).toUpperCase();
  const relevanceLanguage = safeText(body?.relevanceLanguage, 2).toLowerCase();
  const order = safeText(body?.order, 12).toLowerCase() || 'relevance';
  const maxResults = Math.max(1, Math.min(8, Math.floor(finite(body?.maxResults) ?? 6)));
  if (!YOUTUBE_REGIONS.has(regionCode) || !YOUTUBE_LANGUAGES.has(relevanceLanguage) || !YOUTUBE_ORDERS.has(order)) {
    throw Object.assign(new Error('Search options are not allowed.'), { status: 400 });
  }
  return { q, regionCode, relevanceLanguage, order, maxResults };
}

function youtubeCacheKey(params) {
  return hash(['yt', params.q.toLowerCase(), params.regionCode, params.relevanceLanguage, params.order, params.maxResults].join('::'));
}

function shapeYoutubeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    videoId: safeText(item?.id?.videoId, 20),
    title: safeText(item?.snippet?.title, 200),
    description: safeText(item?.snippet?.description, 500),
    channel: safeText(item?.snippet?.channelTitle, 120),
    publishedAt: safeText(item?.snippet?.publishedAt, 40),
  })).filter((item) => item.videoId);
}

async function youtubeSearch(req, body, fetcher = fetch) {
  const params = validateYoutubeBody(body);
  const ref = db.collection(YOUTUBE_CACHE).doc(youtubeCacheKey(params));
  const saved = (await ref.get()).data();
  if (Array.isArray(saved?.items) && timestampMillis(saved.expiresAt) > Date.now()) {
    return { cached: true, items: saved.items };
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw Object.assign(new Error('Video search is unavailable.'), { status: 503 });
  await useQuota(req, 'youtube', DAILY_YOUTUBE_CALLS, DAILY_GLOBAL_YOUTUBE_CALLS);
  const search = new URLSearchParams({ part: 'snippet', type: 'video', order: params.order, maxResults: String(params.maxResults), q: params.q, key: apiKey });
  if (params.regionCode) search.set('regionCode', params.regionCode);
  if (params.relevanceLanguage) search.set('relevanceLanguage', params.relevanceLanguage);
  const response = await fetcher(`https://www.googleapis.com/youtube/v3/search?${search}`, { signal: AbortSignal.timeout(8000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message || `Video search failed (${response.status}).`), { status: 502 });
  }
  const items = shapeYoutubeItems(payload?.items);
  await ref.set({
    items,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + YOUTUBE_CACHE_MS),
  });
  return { cached: false, items };
}

function validateModelBody(body) {
  if (!body || typeof body !== 'object') throw new Error('Missing model request.');
  if (!ALLOWED_MODELS.has(body.model)) throw new Error('Model is not allowed.');
  const max = Number(body.max_tokens);
  if (!Number.isFinite(max) || max < 1 || max > 6000) throw new Error('Token limit is not allowed.');
  if (!Array.isArray(body.messages) || body.messages.length !== 1) throw new Error('Message shape is not allowed.');
  const tools = Array.isArray(body.tools) ? body.tools : [];
  if ((tools.length && body.model !== 'claude-haiku-4-5') || tools.some((tool) => (
    tool?.type !== 'web_search_20260209'
    || tool?.name !== 'web_search'
    || Number(tool?.max_uses || 0) !== 1
    || !Array.isArray(tool?.allowed_callers)
    || tool.allowed_callers.length !== 1
    || tool.allowed_callers[0] !== 'direct'
  ))) {
    throw new Error('Tool request is not allowed.');
  }
  const bytes = Buffer.byteLength(JSON.stringify(body));
  if (bytes > 7_000_000) throw new Error('Request is too large.');
}

function validateIdentifyBody(body) {
  const images = body?.images;
  if (!images || typeof images !== 'object') throw new Error('Card images are required.');
  const clean = {};
  let total = 0;
  for (const key of ['full', 'detail']) {
    const value = images[key];
    if (typeof value !== 'string' || value.length < 100 || value.length > 5_000_000
      || !/^[A-Za-z0-9+/=]+$/.test(value)) {
      throw new Error(`Card ${key} image is invalid.`);
    }
    total += value.length;
    clean[key] = value;
  }
  if (total > 8_000_000) throw new Error('Card images are too large.');
  return clean;
}

function geminiIdentifyRequest(images) {
  return {
    systemInstruction: { parts: [{ text: CARD_IDENTIFIER_SYSTEM }] },
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: images.full } },
        { text: 'Full card photo.' },
        { inlineData: { mimeType: 'image/jpeg', data: images.detail } },
        { text: 'Close crop of the printed code area. Identify the card and copy the code exactly.' },
      ],
    }],
    generationConfig: {
      maxOutputTokens: 1000,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'minimal' },
    },
  };
}

function shapeGeminiIdentifyResponse(payload) {
  const text = (payload?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .filter((part) => part?.text && !part?.thought)
    .map((part) => part.text)
    .join('')
    .trim();
  if (!text) throw new Error('Gemini returned no card identification.');
  const usage = payload?.usageMetadata || {};
  return {
    provider: 'google-vertex',
    model: GEMINI_CARD_MODEL,
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: Number(usage.promptTokenCount || 0),
      output_tokens: Number(usage.candidatesTokenCount || 0) + Number(usage.thoughtsTokenCount || 0),
    },
  };
}

async function callGeminiIdentify(req, body) {
  const images = validateIdentifyBody(body);
  await useModelQuota(req);
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'bakers-agent';
  const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/${VERTEX_LOCATION}`
    + `/publishers/google/models/${GEMINI_CARD_MODEL}:generateContent`;
  const client = await googleAuth.getClient();
  const response = await client.request({
    url,
    method: 'POST',
    data: geminiIdentifyRequest(images),
  });
  return shapeGeminiIdentifyResponse(response.data);
}

async function useQuota(req, kind, perInstall, perDay) {
  const install = safeText(req.get('x-signal-install-id'), 120)
    || safeText(req.get('x-forwarded-for')?.split(',')[0], 120)
    || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const suffix = kind === 'model' ? '' : `_${kind}`;
  const ref = db.collection(LIMITS).doc(`${day}_${hash(install).slice(0, 32)}${suffix}`);
  const globalRef = db.collection(LIMITS).doc(`${day}_global${suffix}`);
  await db.runTransaction(async (transaction) => {
    const [snap, globalSnap] = await Promise.all([transaction.get(ref), transaction.get(globalRef)]);
    const count = Number(snap.data()?.count || 0);
    const globalCount = Number(globalSnap.data()?.count || 0);
    if (count >= perInstall) {
      throw Object.assign(new Error(kind === 'model' ? 'Daily scan limit reached.' : 'Daily video search limit reached.'), { status: 429 });
    }
    if (globalCount >= perDay) {
      throw Object.assign(new Error('Signal is resting until tomorrow (UTC). Try again then.'), { status: 429 });
    }
    const stamp = { day, updatedAt: FieldValue.serverTimestamp() };
    transaction.set(ref, { ...stamp, count: count + 1 }, { merge: true });
    transaction.set(globalRef, { ...stamp, count: globalCount + 1 }, { merge: true });
  });
}

async function useModelQuota(req) {
  return useQuota(req, 'model', DAILY_MODEL_CALLS, DAILY_GLOBAL_MODEL_CALLS);
}

async function callAnthropic(req, modelBody) {
  validateModelBody(modelBody);
  await useModelQuota(req);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Gateway secret is unavailable.');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(modelBody),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { error: { message: text.slice(0, 500) } }; }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Model request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function claimReport(ref, cacheKey, card, force = false) {
  const owner = crypto.randomUUID();
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const saved = snap.data();
    const now = Date.now();
    const disposition = reportDisposition(saved, now, force);
    if (disposition === 'cached') return { disposition, saved };
    if (disposition === 'wait') return { disposition };
    transaction.set(ref, {
      cacheKey,
      card,
      inFlightOwner: owner,
      inFlightUntil: Timestamp.fromMillis(now + REPORT_LEASE_MS),
    }, { merge: true });
    return { disposition: 'claim', owner };
  });
}

async function waitForReport(ref) {
  const deadline = Date.now() + REPORT_WAIT_MS;
  while (Date.now() < deadline) {
    await delay(REPORT_POLL_MS);
    const saved = (await ref.get()).data();
    const disposition = reportDisposition(saved);
    if (disposition === 'cached') return saved;
    if (disposition === 'claim') return null;
  }
  const error = new Error('This card report is still running. Try again shortly.');
  error.status = 409;
  throw error;
}

async function releaseReportClaim(ref, owner) {
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (snap.data()?.inFlightOwner !== owner) return;
    transaction.set(ref, {
      inFlightOwner: FieldValue.delete(),
      inFlightUntil: FieldValue.delete(),
    }, { merge: true });
  });
}

async function analyze(req, body, retry = 0) {
  const cacheKey = safeText(body.cacheKey, 500);
  if (!cacheKey) throw new Error('Missing cache key.');
  const id = hash(cacheKey);
  const ref = db.collection(REPORTS).doc(id);
  const card = body.card && typeof body.card === 'object' ? body.card : {};
  // A forced refresh still waits behind a live lease so two phones pressing
  // Re-scan together pay once.
  const claim = await claimReport(ref, cacheKey, card, retry === 0 && Boolean(body.force));
  if (claim.disposition === 'cached') return cachedReport(claim.saved);
  if (claim.disposition === 'wait') {
    const saved = await waitForReport(ref);
    if (saved) return cachedReport(saved);
    if (retry >= 1) {
      const error = new Error('The first card report stopped before finishing. Try again.');
      error.status = 409;
      throw error;
    }
    return analyze(req, body, retry + 1);
  }

  const modelStartedAt = Date.now();
  try {
    const result = await callAnthropic(req, body.modelRequest);
    const createdAt = new Date();
    await ref.set({
      cacheKey,
      card,
      rawResponse: result,
      createdAt: Timestamp.fromDate(createdAt),
      expiresAt: Timestamp.fromMillis(createdAt.getTime() + REPORT_TTL_MS),
      modelDurationMs: createdAt.getTime() - modelStartedAt,
      inFlightOwner: FieldValue.delete(),
      inFlightUntil: FieldValue.delete(),
    }, { merge: true });
    return { cached: false, createdAt: createdAt.toISOString(), result };
  } catch (error) {
    await releaseReportClaim(ref, claim.owner).catch(() => {});
    throw error;
  }
}

async function observe(body) {
  const measurement = body.measurement && typeof body.measurement === 'object' ? body.measurement : {};
  const score = finite(measurement.score);
  if (score === null || score < 0 || score > 100) throw new Error('Invalid score.');
  const price = finite(measurement.price);
  await db.collection(MEASUREMENTS).add({
    cacheKey: safeText(body.cacheKey, 500),
    cardName: safeText(measurement.cardName, 180),
    game: safeText(measurement.game, 40),
    cardId: safeText(measurement.cardId, 220),
    score,
    scoreVersion: finite(measurement.scoreVersion),
    direction: safeText(measurement.direction, 40),
    price,
    cached: Boolean(measurement.cached),
    observedAt: FieldValue.serverTimestamp(),
  });
  return { recorded: true };
}

async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.action === 'health') return res.json({ ok: true, service: 'signal-gateway-v1' });
    if (body.action === 'catalogueFetch') return res.json(await catalogueFetch(body));
    if (body.action === 'tcgplayerSearch') return res.json(await tcgplayerSearch(body));
    if (body.action === 'yugiohArt') return res.json(await yugiohArt(body));
    if (body.action === 'youtubeSearch') {
      requireAppToken(body);
      return res.json(await youtubeSearch(req, body));
    }
    if (body.action === 'identifyCard') {
      requireAppToken(body);
      const result = await callGeminiIdentify(req, body);
      return res.json({ cached: false, result });
    }
    if (body.action === 'vision') {
      requireAppToken(body);
      const result = await callAnthropic(req, body.modelRequest);
      return res.json({ cached: false, result });
    }
    if (body.action === 'analyze') {
      requireAppToken(body);
      return res.json(await analyze(req, body));
    }
    if (body.action === 'observe') return res.json(await observe(body));
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error) {
    console.error('signal-gateway', error);
    return res.status(error.status || 500).json({ error: error.message || 'Gateway failed.' });
  }
}

functions.http('signalGateway', handler);

module.exports = {
  handler, hash, finite, validateModelBody, validateIdentifyBody,
  geminiIdentifyRequest, shapeGeminiIdentifyResponse, reportDisposition,
  officialCardCid, officialSetPid, officialSetImage, catalogueTarget, catalogueFetch, tcgplayerSearch,
  requireAppToken, validateYoutubeBody, youtubeCacheKey, shapeYoutubeItems,
  DAILY_GLOBAL_MODEL_CALLS, DAILY_GLOBAL_YOUTUBE_CALLS, GEMINI_CARD_MODEL,
};
