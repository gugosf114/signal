export const MAX_GATEWAY_SEARCHES = 1;
export const ANALYSIS_MAX_TOKENS = 8000;
export const FIXED_SEARCH_TARGET =
  'Find the single strongest current source missing from the supplied tournament, Reddit, or YouTube evidence.';

// Every fresh report gets the same bounded research pass. The old gap-based
// budget gave Claude up to two dynamic searches. On sparse cards that turned
// into long chains of code-execution filters, while an easier card finished
// after only a few. One direct search keeps the work and bill predictable.
export function selectSearchTargets() {
  return [FIXED_SEARCH_TARGET];
}

export function directSearchTool() {
  return {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: MAX_GATEWAY_SEARCHES,
    allowed_callers: ['direct'],
  };
}
