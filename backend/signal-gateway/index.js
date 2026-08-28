const crypto = require('crypto');
const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue, Timestamp } = require('@google-cloud/firestore');

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
const ALLOWED_MODELS = new Set(['claude-haiku-4-5', 'claude-sonnet-4-6']);

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

function reportDisposition(saved, now = Date.now()) {
  if (saved?.rawResponse && timestampMillis(saved.expiresAt) > now) return 'cached';
  if (saved?.inFlightOwner && timestampMillis(saved.inFlightUntil) > now) return 'wait';
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

function validateModelBody(body) {
  if (!body || typeof body !== 'object') throw new Error('Missing model request.');
  if (!ALLOWED_MODELS.has(body.model)) throw new Error('Model is not allowed.');
  const max = Number(body.max_tokens);
  if (!Number.isFinite(max) || max < 1 || max > 8000) throw new Error('Token limit is not allowed.');
  if (!Array.isArray(body.messages) || body.messages.length !== 1) throw new Error('Message shape is not allowed.');
  const tools = Array.isArray(body.tools) ? body.tools : [];
  if (tools.some((tool) => (
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

async function useModelQuota(req) {
  const install = safeText(req.get('x-signal-install-id'), 120)
    || safeText(req.get('x-forwarded-for')?.split(',')[0], 120)
    || 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection(LIMITS).doc(`${day}_${hash(install).slice(0, 32)}`);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const count = Number(snap.data()?.count || 0);
    if (count >= DAILY_MODEL_CALLS) {
      const error = new Error('Daily scan limit reached.');
      error.status = 429;
      throw error;
    }
    transaction.set(ref, {
      count: count + 1,
      day,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
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

async function claimReport(ref, cacheKey, card) {
  const owner = crypto.randomUUID();
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const saved = snap.data();
    const now = Date.now();
    const disposition = reportDisposition(saved, now);
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
  const claim = await claimReport(ref, cacheKey, card);
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
    if (body.action === 'yugiohArt') return res.json(await yugiohArt(body));
    if (body.action === 'vision') {
      const result = await callAnthropic(req, body.modelRequest);
      return res.json({ cached: false, result });
    }
    if (body.action === 'analyze') return res.json(await analyze(req, body));
    if (body.action === 'observe') return res.json(await observe(body));
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error) {
    console.error('signal-gateway', error);
    return res.status(error.status || 500).json({ error: error.message || 'Gateway failed.' });
  }
}

functions.http('signalGateway', handler);

module.exports = {
  handler, hash, finite, validateModelBody, reportDisposition,
  officialCardCid, officialSetPid, officialSetImage,
};
