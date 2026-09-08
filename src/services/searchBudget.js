export const MAX_GATEWAY_SEARCHES = 1;
export const ANALYSIS_MAX_TOKENS = 6000;
export const FIXED_SEARCH_TARGET =
  'Run one broad discovery search, not a price lookup. Search the card name and set with deck, tournament, review, community, creator, and Japan terms. Exclude eBay, stores, shops, and generic price listings. Return a mixed result page that can support several research areas at once.';

// Every fresh report still pays for one search. A single search result page
// carries several records; citations.js sorts all useful records into the
// eight areas instead of throwing away everything except Haiku's one choice.
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
