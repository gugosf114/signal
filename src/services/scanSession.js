import { isExactScanTarget } from './scanIdentity.js';
import { normalizeCardRecord, withCardRecord } from './cardRecord.js';

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
  const pin = normalizeCardRecord(scan?.pin || {}, { name: scan?.name, game: scan?.game });
  return writeSession({
    status: 'pending',
    name: String(scan?.name || '').trim(),
    game: scan?.game || null,
    pin,
    force: Boolean(scan?.force),
    startedAt: Number(scan?.startedAt) || Date.now(),
  }, storage);
}

export function saveCompletedScanSession(scan, storage) {
  const pin = normalizeCardRecord(scan?.pin || scan?.result?.card || scan?.result?._pin || {}, {
    name: scan?.name || scan?.result?.card_name,
    game: scan?.game || scan?.result?.game,
  });
  const result = withCardRecord(scan?.result, pin);
  return writeSession({
    status: 'complete',
    name: String(scan?.name || '').trim(),
    game: scan?.game || scan?.result?.game || null,
    pin,
    result,
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
    const pin = normalizeCardRecord(value.pin || {}, { name: value.name, game: value.game });
    if (age >= 0 && age <= PENDING_MAX_AGE_MS && isExactScanTarget(value.game, pin)) {
      return writeSession({ ...value, name: pin.name, game: pin.game, pin }, storage);
    }
  }

  if (value.status === 'complete' && value.result) {
    const age = now - Number(value.completedAt || 0);
    const pin = normalizeCardRecord(value.pin || value.result?.card || value.result?._pin || value.result?.printing || {}, {
      name: value.name || value.result?.card_name,
      game: value.game || value.result?.game,
    });
    const game = value.game || value.result?.game;
    if (age >= 0 && age <= COMPLETE_MAX_AGE_MS && isExactScanTarget(game, pin)) {
      const result = withCardRecord(value.result, pin);
      return writeSession({
        ...value,
        name: result?.card?.name || pin.name,
        game,
        pin: result?.card || pin,
        result,
      }, storage);
    }
  }

  clearScanSession(storage);
  return null;
}

export { SESSION_KEY, PENDING_MAX_AGE_MS, COMPLETE_MAX_AGE_MS };
