const DEFAULT_SCAN_MS = Object.freeze({
  mtg: 32000,
  yugioh: 80000,
  pokemon: 90000,
  auto: 90000,
});

const RUNNING_CEILING = 98;
const TIMING_KEY = 'signal_scan_timing_v1';

function storageOrNull(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function expectedScanDurationMs(game, storage = null) {
  const key = String(game || 'auto').toLowerCase();
  const fallback = DEFAULT_SCAN_MS[key] || DEFAULT_SCAN_MS.auto;
  try {
    const saved = JSON.parse(storageOrNull(storage)?.getItem(TIMING_KEY) || '{}');
    const measured = Number(saved[key]);
    return measured >= 15000 && measured <= 115000 ? measured : fallback;
  } catch {
    return fallback;
  }
}

export function recordScanDuration(game, durationMs, { sharedCache = false, storage = null } = {}) {
  if (sharedCache) return null;
  const key = String(game || 'auto').toLowerCase();
  const duration = Number(durationMs);
  if (!Number.isFinite(duration) || duration < 5000 || duration > 120000) return null;
  const target = storageOrNull(storage);
  if (!target) return null;
  try {
    const saved = JSON.parse(target.getItem(TIMING_KEY) || '{}');
    const prior = Number(saved[key]);
    const next = Math.round(prior >= 15000 && prior <= 115000
      ? prior * 0.7 + duration * 0.3
      : duration);
    saved[key] = next;
    target.setItem(TIMING_KEY, JSON.stringify(saved));
    return next;
  } catch {
    return null;
  }
}

// The API returns one finished answer, not honest step-by-step percentages.
// Until that answer lands, move at one constant speed and reserve the last 2%
// for real completion. This keeps the meter smooth without claiming the work
// is done before it is.
export function linearScanProgress(elapsedMs, expectedMs, complete = false) {
  if (complete) return 100;
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const duration = Math.max(1, Number(expectedMs) || 1);
  return Math.min(RUNNING_CEILING, (elapsed / duration) * RUNNING_CEILING);
}

export { RUNNING_CEILING, TIMING_KEY };
