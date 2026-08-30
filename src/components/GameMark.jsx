import React from 'react';
import pokeBallMark from '../assets/binders/poke-ball.svg';
import yugiohTcgLogo from '../assets/binders/yugioh-tcg-logo.png';
import magicLogo from '../assets/binders/magic-logo.png';

const MARKS = {
  pokemon: pokeBallMark,
  yugioh: yugiohTcgLogo,
  mtg: magicLogo,
};

export default function GameMark({ game, compact = false }) {
  const src = MARKS[game];
  if (!src) return null;
  return (
    <span className={`game-row-mark game-row-mark--${game}${compact ? ' game-row-mark--compact' : ''}`} aria-hidden="true">
      <img src={src} alt="" />
    </span>
  );
}
