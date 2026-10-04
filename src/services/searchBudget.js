export const MAX_GATEWAY_SEARCHES = 2;
export const ANALYSIS_MAX_TOKENS = 6000;
export const FIXED_SEARCH_TARGET =
  'Run one broad discovery search, not a price lookup. Search the card name and set with deck, tournament, review, community, creator, and Japan terms. Exclude eBay, stores, shops, and generic price listings. Return a mixed result page that can support several research areas at once.';

// Two bounded searches: English discovery and a dedicated Japanese query.
// George approved the extra search cost on 2026-10-04.
export function selectSearchTargets(game, { cardName = '', pin = null, jp = null } = {}) {
  const aliases = jp?.identity?.aliases || [];
  const identity = [aliases[0] || cardName, jp?.identity?.setNames?.[0] || pin?.setName].filter(Boolean).join(' ');
  return [FIXED_SEARCH_TARGET, `Run a SEPARATE Japanese-language web_search for: ${identity} ${game === 'yugioh' ? '遊戯王' : game === 'mtg' ? 'MTG' : 'ポケカ'} 発売 再販 抽選 話題. Search Japanese publishers and official card/release pages. English videos returned by a Japan region setting do not count as Japanese evidence. Release, restock, reservation and lottery news may match the selected expansion without naming this card. Supply news may match that expansion; franchise news may match the character or game. Exact-card creator evidence still requires the selected printing or a source-proven Japanese counterpart. Never guess a counterpart's number or set.`];
}

export function directSearchTool() {
  return {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: MAX_GATEWAY_SEARCHES,
    allowed_callers: ['direct'],
  };
}
