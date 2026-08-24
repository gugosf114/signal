const SESSION_KEY = 'signal_active_scan_v1';
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;
const COMPLETE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function targetStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function writeSession(value, storage) {
  try {
    targetStorage(storage)?.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {}
  return value;
}

export function savePendingScanSession(scan, storage) {
  return writeSession({
    status: 'pending',
    name: String(scan?.name || '').trim(),
    game: scan?.game || null,
    pin: scan?.pin || null,
    force: Boolean(scan?.force),
    startedAt: Number(scan?.startedAt) || Date.now(),
  }, storage);
}

export function saveCompletedScanSession(scan, storage) {
  return writeSession({
    status: 'complete',
    name: String(scan?.name || '').trim(),
    game: scan?.game || scan?.result?.game || null,
    pin: scan?.pin || scan?.result?._pin || null,
    result: scan?.result || null,
    completedAt: Number(scan?.completedAt) || Date.now(),
  }, storage);
}

export function clearScanSession(storage) {
  try {
    targetStorage(storage)?.removeItem(SESSION_KEY);
  } catch {}
}

export function loadRecoverableScanSession(storage, now = Date.now()) {
  let value;
  try {
    const raw = targetStorage(storage)?.getItem(SESSION_KEY);
    if (!raw) return null;
    value = JSON.parse(raw);
  } catch {
    clearScanSession(storage);
    return null;
  }

  if (!value || !value.name) {
    clearScanSession(storage);
    return null;
  }

  if (value.status === 'pending') {
    const age = now - Number(value.startedAt || 0);
    if (age >= 0 && age <= PENDING_MAX_AGE_MS) return value;
  }

  if (value.status === 'complete' && value.result) {
    const age = now - Number(value.completedAt || 0);
    if (age >= 0 && age <= COMPLETE_MAX_AGE_MS) return value;
  }

  clearScanSession(storage);
  return null;
}

export { SESSION_KEY, PENDING_MAX_AGE_MS, COMPLETE_MAX_AGE_MS };
