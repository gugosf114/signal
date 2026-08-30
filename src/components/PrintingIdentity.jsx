import React, { useEffect, useMemo, useState } from 'react';
import pokeBallMark from '../assets/binders/poke-ball.svg';
import yugiohTcgLogo from '../assets/binders/yugioh-tcg-logo.png';
import magicLogo from '../assets/binders/magic-logo.png';

function printingCode(printing) {
  const { game, setId, number, printedTotal } = printing || {};
  if (game === 'pokemon' && number) return printedTotal ? `${number}/${printedTotal}` : String(number);
  if (game === 'mtg' && number) return setId ? `${String(setId).toUpperCase()} ${number}` : String(number);
  return number ? String(number) : (setId ? String(setId).toUpperCase() : null);
}

function fallbackMark(game) {
  if (game === 'pokemon') return pokeBallMark;
  if (game === 'yugioh') return yugiohTcgLogo;
  return magicLogo;
}

export default function PrintingIdentity({ printing }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const game = printing?.game || null;
  const setName = printing?.setName || printing?.setId || null;
  const code = printingCode(printing);
  const details = [code, printing?.rarity].filter(Boolean).join(' · ');
  const setLogo = useMemo(() => {
    if (game === 'pokemon') return printing?.setLogoUrl || null;
    if (game === 'mtg' && printing?.setId) {
      return `https://svgs.scryfall.io/sets/${String(printing.setId).toLowerCase()}.svg`;
    }
    return null;
  }, [game, printing?.setId, printing?.setLogoUrl]);

  useEffect(() => setLogoFailed(false), [setLogo]);
  if (!setName && !details) return null;

  const imageUrl = setLogo && !logoFailed ? setLogo : fallbackMark(game);
  return (
    <div className={`printing-identity printing-identity--${game || 'unknown'}`}>
      <span className="printing-identity-art" aria-hidden="true">
        <img
          src={imageUrl}
          alt=""
          className={setLogo && !logoFailed ? 'printing-identity-set-logo' : 'printing-identity-game-mark'}
          onError={() => setLogoFailed(true)}
        />
      </span>
      <span className="printing-identity-copy">
        {setName && <strong>{setName}</strong>}
        {details && <small>{details}</small>}
      </span>
    </div>
  );
}
