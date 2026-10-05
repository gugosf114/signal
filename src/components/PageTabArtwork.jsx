import React, { useId } from 'react';

// Small original illustrations, drawn as objects rather than interface icons.
export default function PageTabArtwork({ kind }) {
  const id = useId().replace(/:/g, '');
  const paint = name => `url(#${id}-${name})`;
  return <svg className="pt-artwork" viewBox="16 1 76 65" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-metal`} x1="22" y1="4" x2="78" y2="64" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F0DFAC" /><stop offset=".43" stopColor="#B89B61" /><stop offset="1" stopColor="#75603E" />
      </linearGradient>
      <linearGradient id={`${id}-ink`} x1="32" y1="12" x2="76" y2="60" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3C4841" /><stop offset="1" stopColor="#151D1A" />
      </linearGradient>
      <linearGradient id={`${id}-paper`} x1="43" y1="9" x2="73" y2="58" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F4EAD4" /><stop offset="1" stopColor="#C6B793" />
      </linearGradient>
      <filter id={`${id}-shadow`} x="-40%" y="-40%" width="190%" height="200%">
        <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#050907" floodOpacity=".3" />
      </filter>
    </defs>
    {kind === 'signal' && <g filter={paint('shadow')}>
      <circle cx="56" cy="33" r="27" fill={paint('metal')} />
      <circle cx="56" cy="33" r="24.5" stroke="#F4E5B9" strokeOpacity=".48" />
      <circle cx="56" cy="33" r="22" fill={paint('ink')} stroke="#645739" />
      <g stroke="#B9A778" strokeOpacity=".27" strokeWidth=".6">
        <path d="M39 23h34M36 33h40M39 43h34M46 15v36M56 11v44M66 15v36" />
        <circle cx="56" cy="33" r="16" />
      </g>
      <path d="M36 38h9l6-10 7 16 8-23 5 12h6" stroke="#111713" strokeWidth="4" strokeLinejoin="round" />
      <path d="M36 37h9l6-10 7 16 8-23 5 12h6" stroke="#E7D6A4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="66" cy="20" r="2.7" fill="#E8DBB8" stroke="#897344" />
      <path d="M56 7v3M56 56v3M30 33h3M79 33h3" stroke="#6B5634" />
    </g>}
    {kind === 'collection' && <g filter={paint('shadow')}>
      <g transform="rotate(-17 43 37)">
        <rect x="23" y="10" width="34" height="47" rx="3" fill="#776547" stroke="#D6C38F" strokeWidth=".8" />
        <rect x="26" y="13" width="28" height="41" rx="1.5" stroke="#D6C38F" strokeOpacity=".55" />
      </g>
      <g transform="rotate(13 65 35)">
        <rect x="49" y="10" width="34" height="47" rx="3" fill={paint('paper')} stroke="#B39B6B" strokeWidth=".8" />
        <rect x="52" y="13" width="28" height="41" rx="1.5" stroke="#96815A" strokeOpacity=".7" />
      </g>
      <rect x="34" y="6" width="37" height="53" rx="3.5" fill={paint('metal')} stroke="#E8D7AA" strokeWidth=".8" />
      <rect x="36.5" y="8.5" width="32" height="48" rx="2" fill={paint('ink')} />
      <path d="M41 14h23M41 49h23M41 52h15" stroke="#C5AD79" strokeWidth=".8" strokeOpacity=".7" />
      <circle cx="52.5" cy="31" r="11.5" stroke="#B79B62" strokeWidth=".7" />
      <path d="m52.5 19 7 12-7 12-7-12z" fill={paint('metal')} />
      <path d="m52.5 21 0 19M47 31h11" stroke="#F1E1B8" strokeOpacity=".65" strokeWidth=".65" />
      <path d="M40 12v41M65 12v41" stroke="#D6BC84" strokeOpacity=".18" strokeWidth=".6" />
    </g>}
    {kind === 'dossier' && <g filter={paint('shadow')}>
      <path d="M29 16a3 3 0 0 1 3-3h14l5 5h26a3 3 0 0 1 3 3v35a3 3 0 0 1-3 3H32a3 3 0 0 1-3-3z" fill="#6C6048" stroke="#CAB585" strokeWidth=".8" />
      <g transform="rotate(5 55 31)">
        <rect x="36" y="8" width="38" height="46" rx="1.5" fill="#BAAD8F" stroke="#E0D1AE" strokeWidth=".7" />
      </g>
      <path d="M36 7h28l9 9v35H36z" fill={paint('paper')} stroke="#EBDFBE" strokeWidth=".65" />
      <path d="M64 7v9h9" fill="#B4A17C" stroke="#97815B" strokeWidth=".5" />
      <path d="M43 19h14M43 25h22M43 29h22M43 33h15" stroke="#766D55" strokeWidth="1" strokeLinecap="round" opacity=".65" />
      <path d="M29 38h51v18a3 3 0 0 1-3 3H32a3 3 0 0 1-3-3z" fill={paint('ink')} stroke="#AE9666" strokeWidth=".8" />
      <path d="M34 43h39M34 55h39" stroke="#CBB17C" strokeOpacity=".26" strokeWidth=".7" />
      <path d="M59 36h8v21l-4-3-4 3z" fill="#783F35" />
      <circle cx="63" cy="44" r="5.5" fill={paint('metal')} stroke="#E9D7AA" strokeWidth=".65" />
      <path d="m63 40 2 4-2 4-2-4z" stroke="#6A583B" strokeWidth=".8" />
    </g>}
  </svg>;
}
