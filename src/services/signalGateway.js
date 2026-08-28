const GATEWAY_URL = 'https://us-central1-bakers-agent.cloudfunctions.net/signal-gateway-v1';
const INSTALL_KEY = 'signal_install_id_v1';

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
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Signal-Install-Id': installId(),
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      const error = new Error(payload.error || `Signal gateway failed (${response.status}).`);
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

export function sharedAnalyze({ cacheKey, card, modelRequest, signal }) {
  return gateway({ action: 'analyze', cacheKey, card, modelRequest }, signal);
}

export function identifyCardViaGateway(modelRequest, signal) {
  return gateway({ action: 'vision', modelRequest }, signal);
}

export function recordSignalMeasurement({ cacheKey, measurement }) {
  return gateway({ action: 'observe', cacheKey, measurement }, undefined, 0);
}

export function getOfficialYugiohArt({ cardName, setCode, rarity }) {
  return gateway({ action: 'yugiohArt', cardName, setCode, rarity }, undefined, 1);
}

export { GATEWAY_URL };
