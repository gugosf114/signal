import React from 'react';
import {
  siYoutube,
  siEbay,
  siReddit,
  siX,
  siTiktok,
  siRakuten,
  siTwitch,
  siGoogle,
  siDiscord,
  siInstagram,
} from 'simple-icons';

// ─── Brand Icon Registry ─────────────────────────────────────────────────────
// All icons render INLINE as SVG — no external CDN, no img tags, no failure
// modes from ad blockers / network. Paths come from simple-icons NPM for the
// majors; mercari, yahoo, pokemon are custom-drawn since simple-icons doesn't
// have them under recognizable slugs.
//
// All colors are deliberately the brand's real identifying color (no muting).
// Loading theater + sources benefit from actual chromatic recognition.

export const BRAND_REGISTRY = {
  // ─── simple-icons (inline path) ───
  youtube:    { si: siYoutube,    color: '#FF0033', display: 'YouTube' },
  google:     { si: siGoogle,     color: '#4285F4', display: 'Google' },
  ebay:       { si: siEbay,       color: '#E53238', display: 'eBay' },
  reddit:     { si: siReddit,     color: '#FF4500', display: 'Reddit' },
  x:          { si: siX,          color: '#E8E4DC', display: 'X' },
  twitter:    { si: siX,          color: '#E8E4DC', display: 'X' },
  tiktok:     { si: siTiktok,     color: '#E8E4DC', display: 'TikTok' },
  discord:    { si: siDiscord,    color: '#5865F2', display: 'Discord' },
  instagram:  { si: siInstagram,  color: '#E4405F', display: 'Instagram' },
  rakuten:    { si: siRakuten,    color: '#BF0000', display: 'Rakuten' },
  twitch:     { si: siTwitch,     color: '#9146FF', display: 'Twitch' },

  // ─── Custom inline (not in simple-icons under that slug) ───
  mercari:    { custom: 'mercari',    color: '#FF0211', display: 'Mercari' },
  yahoo:      { custom: 'yahoo',      color: '#5F01D1', display: 'Yahoo!' },
  pokemon:    { custom: 'pokemon',    color: '#FFCB05', display: 'Pokémon' },
  tcgplayer:  { custom: 'tcgplayer',  color: '#F47A1F', display: 'TCGPlayer' },
  yugioh:     { custom: 'yugioh',     color: '#B58F18', display: 'Yu-Gi-Oh!' },
  mtg:        { custom: 'mtg',        color: '#D43A2F', display: 'Magic' },
  limitless:  { custom: 'limitless',  color: '#7BB661', display: 'Limitless' },
  pokebeach:  { custom: 'pokebeach',  color: '#2A75BB', display: 'PokeBeach' },
  game8:      { custom: 'game8',      color: '#FF6B00', display: 'Game8' },
  tcgfish:    { custom: 'tcgfish',    color: '#4A8BC2', display: 'TCGFish' },
  mtggoldfish:{ custom: 'mtggoldfish',color: '#FFB74D', display: 'MTGGoldfish' },
  bulbapedia: { custom: 'bulbapedia', color: '#0070BB', display: 'Bulbapedia' },
};

// ─── Brand resolution ────────────────────────────────────────────────────────
// Match a URL or freeform string to the registry. Order matters: longer,
// more specific keys first.

const HOST_HINTS = [
  ['youtu',           'youtube'],
  ['x.com',           'x'],
  ['twitter',         'x'],
  ['tiktok',          'tiktok'],
  ['reddit',          'reddit'],
  ['discord',         'discord'],
  ['instagram',       'instagram'],
  ['twitch',          'twitch'],
  ['ebay',            'ebay'],
  ['tcgplayer',       'tcgplayer'],
  ['mercari',         'mercari'],
  ['rakuten',         'rakuten'],
  ['yahoo',           'yahoo'],
  ['pokemon.com',     'pokemon'],
  ['pokebeach',       'pokebeach'],
  ['game8',           'game8'],
  ['tcgfish',         'tcgfish'],
  ['mtggoldfish',     'mtggoldfish'],
  ['bulbapedia',      'bulbapedia'],
  ['limitlesstcg',    'limitless'],
  ['limitless',       'limitless'],
  ['google',          'google'],
];

export function resolveBrand(input) {
  if (!input) return null;
  const s = String(input).toLowerCase();
  for (const [hint, brand] of HOST_HINTS) {
    if (s.includes(hint)) return brand;
  }
  for (const k of Object.keys(BRAND_REGISTRY)) {
    if (s.includes(k)) return k;
  }
  return null;
}

export function brandFromUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return resolveBrand(host);
  } catch {
    // URL didn't parse — return null rather than substring-matching the raw
    // string, which would let stray params (e.g. ?ref=youtube.com) attribute
    // a foreign URL to the wrong brand.
    return null;
  }
}

// ─── BrandIcon component ─────────────────────────────────────────────────────

export function BrandIcon({ brand, size = 16, className, style }) {
  if (!brand) return null;
  const meta = BRAND_REGISTRY[brand];
  if (!meta) return null;

  // simple-icons path
  if (meta.si) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        style={{ display: 'block', ...style }}
        aria-label={meta.display}
        role="img"
      >
        <path d={meta.si.path} fill={meta.color} />
      </svg>
    );
  }

  // Custom inline
  return (
    <CustomBrandSvg
      kind={meta.custom}
      color={meta.color}
      size={size}
      label={meta.display}
      className={className}
      style={style}
    />
  );
}

// ─── Custom inline SVG marks ─────────────────────────────────────────────────

function CustomBrandSvg({ kind, color, size, label, className, style }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    style: { display: 'block', ...style },
    role: 'img',
    'aria-label': label,
    xmlns: 'http://www.w3.org/2000/svg',
  };
  switch (kind) {
    case 'mercari':
      // Stylized lowercase "m" circle — Mercari's recognizable mark
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="11" fill={color} />
          <path
            d="M 7 16 L 7 9 Q 7 7.5 8.5 7.5 Q 10 7.5 10 9 L 10 16 M 14 16 L 14 9 Q 14 7.5 15.5 7.5 Q 17 7.5 17 9 L 17 16 M 10.5 9.5 Q 12 7.5 13.5 9.5"
            stroke="#fff"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'yahoo':
      // "Y!" purple wordmark
      return (
        <svg {...props}>
          <text
            x="12"
            y="17"
            textAnchor="middle"
            fontSize="16"
            fontWeight="900"
            fontFamily="'Syne', sans-serif"
            fill={color}
            letterSpacing="-0.02em"
          >Y!</text>
        </svg>
      );

    case 'pokemon':
      // Stylized Pokéball — instantly recognizable, no trademark issues with the ball shape
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" fill="#fff" stroke={color} strokeWidth="1.5" />
          <path d="M 2 12 A 10 10 0 0 1 22 12 L 14 12 A 2 2 0 0 0 10 12 Z" fill={color} />
          <line x1="2" y1="12" x2="10" y2="12" stroke="#000" strokeWidth="1" />
          <line x1="14" y1="12" x2="22" y2="12" stroke="#000" strokeWidth="1" />
          <circle cx="12" cy="12" r="2" fill="#fff" stroke="#000" strokeWidth="1" />
        </svg>
      );

    case 'tcgplayer':
      // Bold "T" mark in TCGPlayer orange
      return (
        <svg {...props}>
          <rect x="2" y="3" width="20" height="4" fill={color} />
          <rect x="9" y="3" width="6" height="18" fill={color} />
        </svg>
      );

    case 'yugioh':
      // Pyramidal star — evokes Millennium Puzzle
      return (
        <svg {...props}>
          <polygon points="12,2 22,12 12,22 2,12" stroke={color} strokeWidth="1.5" fill="none" />
          <polygon points="12,7 17,12 12,17 7,12" fill={color} />
        </svg>
      );

    case 'mtg':
      // Five-mana planeswalker pentagon
      return (
        <svg {...props}>
          <polygon points="12,2 22,9 18,21 6,21 2,9" stroke={color} strokeWidth="1.5" fill="none" />
          <circle cx="12" cy="13" r="2.5" fill={color} />
        </svg>
      );

    case 'limitless':
      // Infinity / lemniscate
      return (
        <svg {...props}>
          <path
            d="M 4 12 C 4 8, 8 8, 12 12 C 16 16, 20 16, 20 12 C 20 8, 16 8, 12 12 C 8 16, 4 16, 4 12 Z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );

    case 'pokebeach':
      // Wave with circle — beach motif
      return (
        <svg {...props}>
          <circle cx="6" cy="8" r="3" fill={color} />
          <path d="M 2 16 Q 7 12, 12 16 T 22 16" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M 2 20 Q 7 17, 12 20 T 22 20" stroke={color} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
        </svg>
      );

    case 'game8':
      // Stylized "8"
      return (
        <svg {...props}>
          <text
            x="12"
            y="18"
            textAnchor="middle"
            fontSize="20"
            fontWeight="900"
            fontFamily="'Syne', sans-serif"
            fill={color}
          >8</text>
        </svg>
      );

    case 'tcgfish':
      return (
        <svg {...props}>
          <path
            d="M 3 12 C 5 8, 9 7, 13 7 C 17 7, 20 9, 21 12 C 20 15, 17 17, 13 17 C 9 17, 5 16, 3 12 Z M 21 12 L 24 9 L 24 15 Z"
            fill={color}
          />
          <circle cx="9" cy="11" r="0.8" fill="#0a0c10" />
        </svg>
      );

    case 'mtggoldfish':
      return (
        <svg {...props}>
          <ellipse cx="12" cy="12" rx="9" ry="5" fill={color} />
          <polygon points="21,12 24,8 24,16" fill={color} />
          <circle cx="9" cy="11" r="0.8" fill="#0a0c10" />
        </svg>
      );

    case 'bulbapedia':
      // Pokeball cross
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5" />
          <circle cx="12" cy="12" r="2.5" fill={color} />
        </svg>
      );

    default:
      return null;
  }
}

// ─── YouTube helpers ─────────────────────────────────────────────────────────

export function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function youtubeThumbUrl(videoId, quality = 'mqdefault') {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
