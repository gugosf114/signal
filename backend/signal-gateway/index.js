const crypto = require('crypto');
const functions = require('@google-cloud/functions-framework');
const { Firestore, FieldValue, Timestamp } = require('@google-cloud/firestore');

const db = new Firestore();
const REPORTS = 'signal_shared_reports_v1';
const MEASUREMENTS = 'signal_score_measurements_v1';
const LIMITS = 'signal_gateway_limits_v1';
const REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
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
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeText(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validateModelBody(body) {
  if (!body || typeof body !== 'object') throw new Error('Missing model request.');
  if (!ALLOWED_MODELS.has(body.model)) throw new Error('Model is not allowed.');
  const max = Number(body.max_tokens);
  if (!Number.isFinite(max) || max < 1 || max > 24000) throw new Error('Token limit is not allowed.');
  if (!Array.isArray(body.messages) || body.messages.length !== 1) throw new Error('Message shape is not allowed.');
  const tools = Array.isArray(body.tools) ? body.tools : [];
  if (tools.some((tool) => tool?.name !== 'web_search' || Number(tool?.max_uses || 0) > 2)) {
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

async function analyze(req, body) {
  const cacheKey = safeText(body.cacheKey, 500);
  if (!cacheKey) throw new Error('Missing cache key.');
  const id = hash(cacheKey);
  const ref = db.collection(REPORTS).doc(id);
  const now = Date.now();
  const snap = await ref.get();
  const saved = snap.data();
  if (saved?.expiresAt?.toMillis?.() > now && saved.rawResponse) {
    return { cached: true, createdAt: saved.createdAt?.toDate?.()?.toISOString() || null, result: saved.rawResponse };
  }

  const result = await callAnthropic(req, body.modelRequest);
  const createdAt = new Date();
  await ref.set({
    cacheKey,
    card: body.card && typeof body.card === 'object' ? body.card : {},
    rawResponse: result,
    createdAt: Timestamp.fromDate(createdAt),
    expiresAt: Timestamp.fromMillis(now + REPORT_TTL_MS),
  });
  return { cached: false, createdAt: createdAt.toISOString(), result };
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

module.exports = { handler, hash, validateModelBody };
