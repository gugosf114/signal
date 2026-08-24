export const MAX_GATEWAY_SEARCHES = 2;

export function selectSearchTargets(resolvedGame, { catalysts, community, creators } = {}) {
  const targets = [];
  if (resolvedGame === 'pokemon') {
    targets.push('Tournament — Limitless usage / ban list');
  } else if ((resolvedGame === 'yugioh' || resolvedGame === 'mtg') && !catalysts) {
    targets.push('Tournament / competitive usage + ban status');
  }
  if (!community) targets.push('Recent community coverage — Reddit');
  if (!creators) targets.push('Recent creator coverage — YouTube');
  return targets.slice(0, MAX_GATEWAY_SEARCHES);
}
