import React, { useId } from 'react';
import {
  siX,
  siRakuten,
  siTwitch,
  siDiscord,
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
  youtube:    { custom: 'youtube',color: 'multi',   display: 'YouTube' },
  google:     { custom: 'google', color: 'multi',   display: 'Google' },
  ebay:       { custom: 'ebay',   color: 'multi',   display: 'eBay' },
  reddit:     { custom: 'reddit', color: 'multi',   display: 'Reddit' },
  x:          { si: siX,          color: '#E8E4DC', display: 'X' },
  twitter:    { si: siX,          color: '#E8E4DC', display: 'X' },
  tiktok:     { custom: 'tiktok', color: 'multi',   display: 'TikTok' },
  discord:    { si: siDiscord,    color: '#5865F2', display: 'Discord' },
  instagram:  { custom: 'instagram', color: 'multi', display: 'Instagram' },
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
  [['youtube.com', 'youtu.be'], 'youtube'],
  [['x.com', 'twitter.com'], 'x'],
  [['tiktok.com'], 'tiktok'],
  [['reddit.com'], 'reddit'],
  [['discord.com', 'discord.gg'], 'discord'],
  [['instagram.com'], 'instagram'],
  [['twitch.tv'], 'twitch'],
  [['ebay.com'], 'ebay'],
  [['tcgplayer.com'], 'tcgplayer'],
  [['mercari.com', 'mercari.jp'], 'mercari'],
  [['rakuten.com', 'rakuten.co.jp'], 'rakuten'],
  [['yahoo.com', 'yahoo.co.jp'], 'yahoo'],
  [['pokemon.com'], 'pokemon'],
  [['pokebeach.com'], 'pokebeach'],
  [['game8.co'], 'game8'],
  [['tcgfish.com'], 'tcgfish'],
  [['mtggoldfish.com'], 'mtggoldfish'],
  [['bulbapedia.bulbagarden.net'], 'bulbapedia'],
  [['limitlesstcg.com'], 'limitless'],
  [['google.com', 'googleapis.com'], 'google'],
];

export function resolveBrand(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (BRAND_REGISTRY[s]) return s === 'twitter' ? 'x' : s;
  const words = new Set(s.split(/[^a-z0-9]+/).filter(Boolean));
  for (const key of Object.keys(BRAND_REGISTRY)) {
    if (key.length > 1 && words.has(key)) return key === 'twitter' ? 'x' : key;
  }
  return null;
}

export function brandFromUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [domains, brand] of HOST_HINTS) {
      if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return brand;
    }
    return null;
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
  const uid = useId().replace(/:/g, '');
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
    case 'youtube':
      // Official YouTube play-button — red rounded rect + white triangle.
      // Source: Wikimedia Commons full-color YouTube icon (2017).
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 28.57 20"
          width={size * 1.43}
          height={size}
          className={className}
          style={{ display: 'block', ...style }}
          role="img"
          aria-label={label}
        >
          <path
            fill="#FF0000"
            d="M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 2.24288e-07 14.285 0 14.285 0C14.285 0 5.35042 2.24288e-07 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C2.24288e-07 5.35042 0 10 0 10C0 10 2.24288e-07 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z"
          />
          <path
            fill="#FFFFFF"
            d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z"
          />
        </svg>
      );

    case 'google':
      // Multi-color G — Wikimedia Commons. Blue, green, yellow, red arcs.
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={className}
          style={{ display: 'block', ...style }}
          role="img"
          aria-label={label}
        >
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      );

    case 'tiktok':
      // TikTok note glyph with cyan + red chromatic-aberration shadows.
      // Black main layer recolored cream (#E8E4DC) so it reads on the
      // app's dark canvas the way TikTok's dark-mode logo does.
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 260 295"
          width={size * 0.88}
          height={size}
          className={className}
          style={{ display: 'block', ...style }}
          role="img"
          aria-label={label}
        >
          <path
            fill="#FF004F"
            d="M191.102,105.182c18.814,13.442,41.862,21.351,66.755,21.351V78.656c-4.711,0.001-9.41-0.49-14.019-1.466v37.686c-24.891,0-47.936-7.909-66.755-21.35v97.703c0,48.876-39.642,88.495-88.54,88.495c-18.245,0-35.203-5.513-49.29-14.968c16.078,16.431,38.5,26.624,63.306,26.624c48.901,0,88.545-39.619,88.545-88.497v-97.701H191.102z M208.396,56.88c-9.615-10.499-15.928-24.067-17.294-39.067v-6.158h-13.285C181.161,30.72,192.567,47.008,208.396,56.88L208.396,56.88z M70.181,227.25c-5.372-7.04-8.275-15.652-8.262-24.507c0-22.354,18.132-40.479,40.502-40.479c4.169-0.001,8.313,0.637,12.286,1.897v-48.947c-4.643-0.636-9.329-0.906-14.013-0.807v38.098c-3.976-1.26-8.122-1.9-12.292-1.896c-22.37,0-40.501,18.123-40.501,40.48C47.901,206.897,56.964,220.583,70.181,227.25z"
          />
          <path
            fill="#E8E4DC"
            d="M177.083,93.525c18.819,13.441,41.864,21.35,66.755,21.35V77.189c-13.894-2.958-26.194-10.215-35.442-20.309c-15.83-9.873-27.235-26.161-30.579-45.225h-34.896v191.226c-0.079,22.293-18.18,40.344-40.502,40.344c-13.154,0-24.84-6.267-32.241-15.975c-13.216-6.667-22.279-20.354-22.279-36.16c0-22.355,18.131-40.48,40.501-40.48c4.286,0,8.417,0.667,12.292,1.896v-38.098c-48.039,0.992-86.674,40.224-86.674,88.474c0,24.086,9.621,45.921,25.236,61.875c14.087,9.454,31.045,14.968,49.29,14.968c48.899,0,88.54-39.621,88.54-88.496V93.525L177.083,93.525z"
          />
          <path
            fill="#00F2EA"
            d="M243.838,77.189V66.999c-12.529,0.019-24.812-3.488-35.442-10.12C217.806,67.176,230.197,74.276,243.838,77.189z M177.817,11.655c-0.319-1.822-0.564-3.656-0.734-5.497V0h-48.182v191.228c-0.077,22.29-18.177,40.341-40.501,40.341c-6.554,0-12.742-1.555-18.222-4.318c7.401,9.707,19.087,15.973,32.241,15.973c22.32,0,40.424-18.049,40.502-40.342V11.655H177.817z M100.694,114.408V103.56c-4.026-0.55-8.085-0.826-12.149-0.824C39.642,102.735,0,142.356,0,191.228c0,30.64,15.58,57.643,39.255,73.527c-15.615-15.953-25.236-37.789-25.236-61.874C14.019,154.632,52.653,115.4,100.694,114.408z"
          />
        </svg>
      );

    case 'reddit':
      // Reddit Snoo — orange circular background + white face details
      // (eyes, mouth, antenna). Source: Wikimedia Commons Reddit logo.
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="-269 361 72 72"
          width={size}
          height={size}
          className={className}
          style={{ display: 'block', ...style }}
          role="img"
          aria-label={label}
        >
          <path
            fill="#FF4500"
            d="m-233 433c-19.9 0-36-16.1-36-36s16.1-36 36-36 36 16.1 36 36-16.1 36-36 36z"
          />
          <path
            fill="#FFFFFF"
            d="m-224.8 404.5c-2.1 0-3.7-1.7-3.7-3.7 0-2.1 1.7-3.8 3.7-3.8s3.7 1.7 3.7 3.8c.1 2-1.6 3.7-3.7 3.7m.7 6.2c-2.6 2.6-7.5 2.8-8.9 2.8s-6.3-.2-8.9-2.8c-.4-.4-.4-1 0-1.4s1-.4 1.4 0c1.6 1.6 5.1 2.2 7.5 2.2 2.5 0 5.9-.6 7.5-2.2.4-.4 1-.4 1.4 0s.4 1 0 1.4m-20.9-9.9c0-2.1 1.7-3.8 3.8-3.8s3.7 1.7 3.7 3.8-1.7 3.7-3.7 3.7c-2.1 0-3.8-1.7-3.8-3.7m36-3.8c0-2.9-2.4-5.3-5.3-5.3-1.4 0-2.7.6-3.6 1.5-3.6-2.6-8.5-4.3-14-4.5l2.4-11.3 7.8 1.7c.1 2 1.7 3.6 3.7 3.6 2.1 0 3.7-1.7 3.7-3.7 0-2.1-1.7-3.7-3.7-3.7-1.5 0-2.7.9-3.3 2.1l-8.7-1.9c-.2-.1-.5 0-.7.1s-.4.3-.4.6l-2.6 12.3v.2c-5.6.1-10.6 1.8-14.3 4.4-.9-.9-2.2-1.5-3.6-1.5-2.9 0-5.3 2.4-5.3 5.3 0 2.1 1.3 4 3.1 4.8-.1.5-.1 1.1-.1 1.6 0 8.1 9.4 14.6 21 14.6s21-6.5 21-14.6c0-.5 0-1.1-.1-1.6 1.7-.7 3-2.6 3-4.7"
          />
        </svg>
      );

    case 'instagram':
      // 2022 Instagram refresh — four radial gradients layered (yellow burst
      // bottom-left, magenta burst, fuchsia top-right, purple top) plus the
      // white camera glyph. IDs prefixed `ig-` to avoid collisions if
      // multiple icons render on the same page.
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 264.5833 264.5833"
          width={size}
          height={size}
          className={className}
          style={{ display: 'block', ...style }}
          role="img"
          aria-label={label}
        >
          <defs>
            <linearGradient id={`${uid}-ig-a`}>
              <stop offset="0" stopColor="#fc0" />
              <stop offset=".1242" stopColor="#fc0" />
              <stop offset=".5672" stopColor="#fe4a05" />
              <stop offset=".6942" stopColor="#ff0f3f" />
              <stop offset="1" stopColor="#fe0657" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-ig-b`}>
              <stop offset="0" stopColor="#fc0" />
              <stop offset="1" stopColor="#fc0" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-ig-c`}>
              <stop offset="0" stopColor="#780cff" />
              <stop stopColor="#820bff" offset="1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-ig-d`}>
              <stop offset="0" stopColor="#ff005f" />
              <stop offset="1" stopColor="#fc01d8" />
            </linearGradient>
            <radialGradient
              id={`${uid}-ig-f`}
              cx="158.429"
              cy="578.088"
              r="52.3515"
              xlinkHref={`#${uid}-ig-a`}
              gradientUnits="userSpaceOnUse"
              gradientTransform="matrix(0 -4.03418 4.28018 0 -2332.2273 942.2356)"
              fx="158.429"
              fy="578.088"
            />
            <radialGradient
              xlinkHref={`#${uid}-ig-b`}
              id={`${uid}-ig-g`}
              gradientUnits="userSpaceOnUse"
              gradientTransform="matrix(.67441 -1.16203 1.51283 .87801 -814.3657 -47.8354)"
              cx="172.6149"
              cy="600.6924"
              fx="172.6149"
              fy="600.6924"
              r="65"
            />
            <radialGradient
              xlinkHref={`#${uid}-ig-c`}
              id={`${uid}-ig-h`}
              cx="144.012"
              cy="51.3367"
              fx="144.012"
              fy="51.3367"
              r="67.081"
              gradientTransform="matrix(-2.3989 .67549 -.23008 -.81732 464.9957 -26.4035)"
              gradientUnits="userSpaceOnUse"
            />
            <radialGradient
              xlinkHref={`#${uid}-ig-d`}
              id={`${uid}-ig-e`}
              gradientUnits="userSpaceOnUse"
              gradientTransform="matrix(-3.10797 .87652 -.6315 -2.23914 1345.6503 1374.1983)"
              cx="199.7884"
              cy="628.4379"
              fx="199.7884"
              fy="628.4379"
              r="52.3515"
            />
          </defs>
          {['ig-e', 'ig-f', 'ig-g', 'ig-h'].map((gradId) => (
            <path
              key={gradId}
              d="M204.1503 18.1429c-55.2305 0-71.3834.057-74.5232.3175-11.3342.9424-18.387 2.7275-26.0708 6.554-5.9214 2.9413-10.5915 6.3506-15.2005 11.1298-8.3938 8.7157-13.481 19.4383-15.3226 32.1842-.8953 6.1877-1.1558 7.4496-1.2087 39.0558-.0203 10.5354 0 24.4007 0 42.9984 0 55.2008.061 71.3418.3256 74.4764.9157 11.032 2.6453 17.9728 6.3081 25.565 7 14.5329 20.369 25.4428 36.119 29.5137 5.4535 1.4044 11.4767 2.1779 19.2092 2.5442 3.2762.1425 36.6684.2443 70.081.2443 33.4127 0 66.8253-.0407 70.02-.2035 8.9535-.4214 14.1526-1.1195 19.9011-2.6054 15.8517-4.0912 28.9767-14.8383 36.119-29.5748 3.5916-7.409 5.4128-14.6144 6.237-25.0704.179-2.2796.2543-38.6263.2543-74.924 0-36.304-.0814-72.5835-.2605-74.8632-.8343-10.6249-2.6555-17.7692-6.363-25.3207-3.0421-6.1816-6.42-10.798-11.324-15.518-8.752-8.3616-19.4555-13.4502-32.2101-15.2902-6.18-.8936-7.411-1.1582-39.033-1.2131z"
              fill={`url(#${uid}-${gradId})`}
              transform="translate(-71.8155 -18.1429)"
            />
          ))}
          <path
            fill="#fff"
            d="M132.3452 33.973c-26.7167 0-30.0696.1167-40.5629.5939-10.4727.4792-17.6212 2.136-23.8762 4.567-6.4701 2.5107-11.9586 5.8693-17.4265 11.3352-5.472 5.464-8.8332 10.9483-11.354 17.4116-2.4389 6.2524-4.099 13.3976-4.5703 23.8585-.4693 10.4854-.5923 13.8379-.5923 40.5348 0 26.697.1189 30.0371.5943 40.5225.4817 10.465 2.1397 17.6082 4.5703 23.8585 2.5147 6.4654 5.8758 11.9497 11.3458 17.4136 5.466 5.468 10.9544 8.8349 17.4204 11.3456 6.259 2.4309 13.4097 4.0877 23.8803 4.567 10.4933.477 13.8441.5938 40.5588.5938 26.7188 0 30.0615-.1167 40.5547-.5939 10.4728-.4792 17.6295-2.136 23.8885-4.567 6.4681-2.5106 11.9484-5.8775 17.4143-11.3455 5.472-5.4639 8.8332-10.9482 11.354-17.4115 2.4183-6.2524 4.0784-13.3976 4.5703-23.8585.4713-10.4854.5943-13.8277.5943-40.5246 0-26.697-.123-30.0473-.5943-40.5328-.4919-10.465-2.152-17.6081-4.5703-23.8584-2.5208-6.4654-5.882-11.9498-11.354-17.4137-5.4721-5.468-10.9442-8.8266-17.4204-11.3353-6.2714-2.4309-13.424-4.0877-23.8967-4.5669-10.4933-.4772-13.8339-.5939-40.5588-.5939zm-8.825 17.7147c2.6193-.0041 5.5418 0 8.825 0 26.2659 0 29.379.0942 39.7513.5652 9.5915.4383 14.7971 2.0397 18.2648 3.3852 4.5908 1.7817 7.8638 3.9116 11.3048 7.3521 3.4431 3.4406 5.5745 6.7173 7.3617 11.3046 1.3465 3.461 2.9512 8.6628 3.3877 18.2472.4714 10.3625.5739 13.4754.5739 39.7095 0 26.234-.1025 29.347-.5739 39.7095-.4386 9.5843-2.0412 14.7861-3.3877 18.2471-1.783 4.5874-3.9186 7.8539-7.3617 11.2923-3.443 3.4406-6.712 5.5704-11.3048 7.3521-3.4636 1.3517-8.6733 2.949-18.2648 3.3873-10.3702.471-13.4854.5734-39.7513.5734-26.2679 0-29.381-.1024-39.7513-.5734-9.5914-.4423-14.797-2.0438-18.2668-3.3893-4.5908-1.7817-7.87-3.9116-11.313-7.3521-3.4431-3.4405-5.5745-6.709-7.3617-11.2985-1.3465-3.461-2.9512-8.6628-3.3877-18.2471-.4714-10.3626-.5657-13.4754-.5657-39.7259 0-26.2504.0943-29.347.5657-39.7095.4386-9.5844 2.0412-14.7861 3.3877-18.2512 1.783-4.5874 3.9186-7.8641 7.3617-11.3046 3.443-3.4406 6.7222-5.5704 11.313-7.3562 3.4677-1.3517 8.6754-2.949 18.2668-3.3894 9.075-.4096 12.5919-.5324 30.9264-.553zm61.3363 16.322c-6.5173 0-11.805 5.2776-11.805 11.792 0 6.5125 5.2877 11.7962 11.805 11.7962 6.5172 0 11.8049-5.2837 11.8049-11.7962 0-6.5124-5.2877-11.796-11.805-11.796zm-52.5113 13.7826c-27.8993 0-50.5191 22.6031-50.5191 50.4817 0 27.8786 22.6198 50.4714 50.5191 50.4714s50.511-22.5928 50.511-50.4714c0-27.8786-22.6137-50.4817-50.513-50.4817zm0 17.7147c18.109 0 32.7914 14.6694 32.7914 32.767 0 18.0956-14.6824 32.767-32.7914 32.767-18.111 0-32.7913-14.6714-32.7913-32.767 0-18.0976 14.6803-32.767 32.7913-32.767z"
          />
        </svg>
      );

    case 'ebay':
      // Real eBay wordmark — official letter paths from Wikimedia Commons,
      // four separate paths colored e=red, b=blue, a=yellow, y=green using
      // the exact hex values from the source SVG (not the marketing-page
      // approximations). Aspect ratio ~2.5:1.
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1000 401"
          width={size * 2.5}
          height={size}
          className={className}
          style={{ display: 'block', ...style }}
          role="img"
          aria-label={label}
        >
          {/* e — red */}
          <path
            fill="#F02D2D"
            d="M 199.63633,185.86602 c -1.94427,-46.87735 -35.77951,-64.41973 -71.94139,-64.41973 -38.99421,0 -70.12667,19.7327 -75.58026,64.41973 z M 51.034408,219.1909 c 2.704332,45.48365 34.069782,72.38437 77.197532,72.38437 29.88033,0 56.45979,-12.17498 65.35948,-38.66041 h 51.68424 c -10.05205,53.73979 -67.15384,71.98058 -116.303,71.98058 C 39.606424,324.89544 0,275.67889 0,209.30653 0,136.24203 40.965642,88.12194 129.78809,88.12194 c 70.69867,0 122.49992,36.99926 122.49992,117.75572 v 13.31324 z"
          />
          {/* b — blue */}
          <path
            fill="#0968F6"
            d="M 380.83181,290.6235 c 46.57228,0 78.44078,-33.52181 78.44078,-84.10854 0,-50.58203 -31.8685,-84.10854 -78.44078,-84.10854 -46.31058,0 -78.44392,33.52651 -78.44392,84.10854 0,50.58673 32.13334,84.10854 78.44392,84.10854 z M 252.2854,0 h 50.10249 l -0.005,125.87707 c 24.55682,-29.25975 58.38892,-37.75513 91.68976,-37.75513 55.83503,0 117.85132,37.6773 117.85132,119.02875 0,68.12232 -49.32155,117.74475 -118.78114,117.74475 -36.35726,0 -70.58062,-13.04265 -91.68663,-38.88294 0,10.32107 -0.57618,20.72364 -1.70503,30.56413 h -49.17162 c 0.85513,-15.90944 1.70555,-35.7184 1.70555,-51.74693 z"
          />
          {/* a — yellow */}
          <path
            fill="#FFBD14"
            d="m 633.07803,212.53323 c -45.43873,1.48929 -73.6715,9.689 -73.6715,39.61897 0,19.37591 15.44713,40.38162 54.66334,40.38162 52.57698,0 80.64259,-28.65902 80.64259,-75.66331 l 0.003,-5.16994 c -18.43302,0 -41.16414,0.16089 -61.63704,0.83266 z m 111.75103,62.10248 c 0,14.58313 0.42155,28.9782 1.69406,41.94092 h -46.61408 c -1.24325,-10.67368 -1.6972,-21.27945 -1.6972,-31.56656 -25.20195,30.97941 -55.17735,39.88537 -96.76149,39.88537 -61.67674,0 -94.70072,-32.59982 -94.70072,-70.30689 0,-54.61215 44.91583,-73.86739 122.89013,-75.65391 21.32332,-0.48686 45.27419,-0.55894 65.07531,-0.55894 l -0.003,-5.33606 c 0,-36.56098 -23.44364,-51.59335 -64.06765,-51.59335 -30.15876,0 -52.38579,12.48057 -54.6764,34.0468 h -52.65168 c 5.57217,-53.77165 62.06643,-67.37115 111.74005,-67.37115 59.50837,0 109.77228,21.17288 109.77228,84.11481 z"
          />
          {/* y — green */}
          <path
            fill="#92C821"
            d="M 1000,96.45747 845.05541,400.75099 H 788.94926 L 833.49578,316.25589 716.89033,96.45747 h 58.6266 l 85.80469,171.73057 85.56283,-171.73057 z"
          />
        </svg>
      );

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
      // Millennium Puzzle triangle with Eye of Wadjet
      return (
        <svg {...props}>
          <polygon points="12,3 22,21 2,21" stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
          <ellipse cx="12" cy="15.5" rx="5.2" ry="3" stroke={color} strokeWidth="1.3" fill="none" />
          <circle cx="12" cy="15.5" r="1.6" fill={color} />
        </svg>
      );

    case 'mtg':
      // Planeswalker spark — four-point burst
      return (
        <svg {...props}>
          <path
            d="M 12 1.5 L 13.6 9.4 L 22.5 12 L 13.6 14.6 L 12 22.5 L 10.4 14.6 L 1.5 12 L 10.4 9.4 Z"
            fill={color}
          />
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

// Single source of truth lives in services/citations.js, where the citation
// filter needs it and where it is unit-tested. This file used to carry a
// hand-copied second definition; the two are now guaranteed to agree.
export { extractYouTubeId } from '../services/citations';

export function youtubeThumbUrl(videoId, quality = 'mqdefault') {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
