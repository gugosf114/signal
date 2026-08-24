const DEFAULT_SCAN_MS = Object.freeze({
  mtg: 32000,
  yugioh: 36000,
  pokemon: 54000,
  auto: 54000,
});

const RUNNING_CEILING = 98;

export function expectedScanDurationMs(game) {
  const key = String(game || 'auto').toLowerCase();
  return DEFAULT_SCAN_MS[key] || DEFAULT_SCAN_MS.auto;
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

export { RUNNING_CEILING };
