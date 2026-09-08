const GATEWAY_URL = 'https://us-central1-bakers-agent.cloudfunctions.net/signal-gateway-v1';
const GATEWAY_DIRECT_URL = 'https://signal-gateway-v1-qfv7mm5hva-uc.a.run.app';
const GATEWAY_EDGE_URL = 'https://signal-gateway-edge.gugosf.workers.dev';
const GATEWAY_URLS = [GATEWAY_EDGE_URL, GATEWAY_URL, GATEWAY_DIRECT_URL];
const INSTALL_KEY = 'signal_install_id_v1';

// Compiled in from .env.local (or the CI secret). The gateway only spends money
// for callers that present it. It rides inside the JSON body because the edge
// worker forwards the body untouched and drops unknown headers.
function appToken() {
  try {
    return import.meta.env?.VITE_SIGNAL_APP_TOKEN || undefined;
  } catch {
    return undefined;
  }
}

function installId() {
  try {
    let value = localStorage.getItem(INSTALL_KEY);
    if (!value) {
      value = globalThis.crypto?.randomUUID?.() || `signal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(INSTALL_KEY, value);
    }
    return value;
  } catch {
    return 'signal-local';
  }
}

function retryDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new DOMException('Request cancelled.', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException('Request cancelled.', 'AbortError'));
    }, { once: true });
  });
}

export async function gateway(body, signal, retries = 2) {
  let lastError;
  const payloadBody = JSON.stringify({ ...body, appToken: appToken() });
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const url = GATEWAY_URLS[Math.min(attempt, GATEWAY_URLS.length - 1)];
      const response = await fetch(url, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Signal-Install-Id': installId(),
        },
        body: payloadBody,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      const error = new Error(payload.error || `Signal gateway failed (${response.status}).`);
      error.status = response.status;
      error.retryable = response.status >= 500;
      if (!error.retryable || attempt === retries) throw error;
      lastError = error;
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) throw error;
      if (error?.retryable === false) throw error;
      lastError = error;
      if (attempt === retries) throw error;
    }
    await retryDelay(350 * (attempt + 1), signal);
  }
  throw lastError || new Error('Signal gateway failed.');
}

export function sharedAnalyze({ cacheKey, card, modelRequest, signal, force = false }) {
  return gateway({ action: 'analyze', cacheKey, card, modelRequest, force: Boolean(force) }, signal);
}

export function identifyCardViaGateway(modelRequest, signal) {
  return gateway({ action: 'vision', modelRequest }, signal);
}

export function identifyCardViaGemini(images, signal) {
  return gateway({ action: 'identifyCard', images }, signal);
}

export function recordSignalMeasurement({ cacheKey, measurement }) {
  return gateway({ action: 'observe', cacheKey, measurement }, undefined, 0);
}

export function getOfficialYugiohArt({ cardName, setCode, rarity }) {
  return gateway({ action: 'yugiohArt', cardName, setCode, rarity }, undefined, 1);
}

// The YouTube key lives on the server. A phone that was built without one
// (CI, Termux) still gets the creator and Japan lanes. Results are cached on
// the server for a day so repeat scans of one card cost no quota.
export async function youtubeSearchViaGateway({ q, regionCode = '', relevanceLanguage = '', order = 'relevance', maxResults = 6 }, signal) {
  const payload = await gateway({ action: 'youtubeSearch', q, regionCode, relevanceLanguage, order, maxResults }, signal, 1);
  return Array.isArray(payload?.items) ? payload.items : [];
}

// Android cannot reliably open the public card APIs itself. The same small
// Cloudflare door used by the scanner asks the server for one allow-listed
// catalogue URL. This stays free of model calls and cannot become an open proxy.
export async function fetchCatalogueJSON(url, signal) {
  const response = await fetch(GATEWAY_EDGE_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Signal-Install-Id': installId(),
    },
    body: JSON.stringify({ action: 'catalogueFetch', url }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.catalogue !== true) {
    throw new Error(payload?.error || 'Card catalogue relay is unavailable.');
  }
  if (payload.status === 400 || payload.status === 404) return null;
  if (!payload.ok) throw new Error(`Card catalogue failed (${payload.status}).`);
  return payload.data;
}

export { GATEWAY_DIRECT_URL, GATEWAY_EDGE_URL, GATEWAY_URL };
