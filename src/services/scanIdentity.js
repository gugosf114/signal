import { hasPrintingPin } from './recentScans.js';

const GAMES = new Set(['pokemon', 'mtg', 'yugioh']);

export function isExactScanTarget(game, pin) {
  const wantedGame = String(game || '').toLowerCase();
  return GAMES.has(wantedGame)
    && String(pin?.game || '').toLowerCase() === wantedGame
    && hasPrintingPin(pin);
}
