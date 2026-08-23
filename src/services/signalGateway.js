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

async function gateway(body, signal) {
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
  if (!response.ok) throw new Error(payload.error || `Signal gateway failed (${response.status}).`);
  return payload;
}

export function sharedAnalyze({ cacheKey, card, modelRequest, signal }) {
  return gateway({ action: 'analyze', cacheKey, card, modelRequest }, signal);
}

export function identifyCardViaGateway(modelRequest, signal) {
  return gateway({ action: 'vision', modelRequest }, signal);
}

export function recordSignalMeasurement({ cacheKey, measurement }) {
  return gateway({ action: 'observe', cacheKey, measurement });
}

export { GATEWAY_URL };
