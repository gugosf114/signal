import React, { useEffect, useState, useMemo, useRef } from 'react';
import { fetchCardImage } from '../services/fetchCardImage';
import { BrandIcon } from '../config/brandIcons';
import { SIGNAL_TYPES } from '../config/signals';

// ─── Loading Theater ─────────────────────────────────────────────────────────
// Tokyo desk at 3am. Solari flip-board × Bloomberg INFO panel × CRT terminal.
// Eight phases × ~4s, dense layered visual narrative. Theater runs independent
// of the API call — when results land, the parent unmounts this and renders.

const PHASES = [
  {
    id: 'tcgplayer',
    title: 'EN MARKETPLACE / PRIMARY',
    pip: 'TCGP',
    color: '#F47A1F',
    jp: false,
    trace: 'sawtooth',
    brands: ['tcgplayer', 'pokemon', 'mtg', 'yugioh'],
    details: [
      'Sold listings · 30-day window',
      'Variant pricing · raw + PSA',
      'Transaction velocity · trend',
    ],
    log: [
      'GET tcgplayer.com/products/...',
      'parsing sold-listing window 30d',
      'isolating variant SKUs',
      'computing 30d EMA',
    ],
  },
  {
    id: 'ebay',
    title: 'EN MARKETPLACE / SECONDARY',
    pip: 'EBAY',
    color: '#E53238',
    jp: false,
    trace: 'sawtooth',
    brands: ['ebay'],
    details: [
      'Auction completion velocity',
      'Buy-It-Now standing inventory',
      'Counterfeit pattern flags',
    ],
    log: [
      'GET ebay.com/sch/i.html?...',
      'filter LH_Sold=1, LH_Complete=1',
      'isolating PSA-graded variants',
      'cross-checking against TCGP delta',
    ],
  },
  {
    id: 'creators',
    title: 'CREATOR CONTENT / EN',
    pip: 'YT▸',
    color: '#FF0033',
    jp: false,
    trace: 'wave',
    brands: ['youtube', 'reddit', 'x', 'tiktok', 'twitch'],
    details: [
      'Leonhart · 1.6M subs',
      'PokeRev · 1.2M subs',
      'Real Break Reviews · 380k',
    ],
    log: [
      'youtube.com search · 30d window',
      'channel: Leonhart · matched 3',
      'channel: PokeRev · matched 2',
      'r/PokemonTCG · top-day cross-ref',
    ],
  },
  {
    id: 'tournament',
    title: 'COMPETITIVE INTELLIGENCE',
    pip: 'CMP◆',
    color: '#7BB661',
    jp: false,
    trace: 'bracket',
    brands: ['limitless', 'mtg', 'yugioh'],
    details: [
      'Regional Indianapolis · Mar 22',
      'Regional San Diego · Apr 5',
      'Limitless · deck-usage rates',
    ],
    log: [
      'limitlesstcg.com/tournaments',
      'parsing top-8 deck lists',
      'usage rate · normalized',
      'ban-list status · current',
    ],
  },
  {
    id: 'japan-crossing',
    title: '渡日中 — Crossing Markets',
    pip: '渡日',
    color: '#C44040',
    jp: true,
    trace: 'kanji',
    kanji: '株',
    brands: ['google', 'pokemon'],
    details: [
      'Japanese name · resolved',
      'JP set release calendar',
      'Translating signal terminology',
    ],
    log: [
      '> shifting locale · jp-JP',
      '> jisho.org · romaji ↔ kanji',
      '> pokebeach.jp · release calendar',
      '> tokyo time · 03:42:11',
    ],
  },
  {
    id: 'mercari',
    title: 'メルカリ — Mercari JP',
    pip: '¥MR',
    color: '#FF0211',
    jp: true,
    trace: 'yen',
    brands: ['mercari', 'rakuten', 'yahoo'],
    details: [
      '¥77,000 · SAR variant · sold',
      '¥125,000 · MUR · active',
      '¥68,500 · Master Art · sold',
    ],
    log: [
      '> jp.mercari.com/search?q=...',
      '> sold history · last 14 days',
      '> ヤフオク crossreference · ok',
      '> ¥/$ · 152.4 · arbitrage delta',
    ],
  },
  {
    id: 'editorial',
    title: 'EDITORIAL SWEEP',
    pip: 'NWS▤',
    color: '#2A75BB',
    jp: false,
    trace: 'columns',
    brands: ['pokebeach', 'game8', 'tcgfish', 'mtggoldfish', 'bulbapedia'],
    details: [
      'PokeBeach · release calendar',
      'Game8 · deck guides',
      'TCGFish · meta watch',
    ],
    log: [
      'pokebeach.com · last 30d',
      'game8.co · meta-tier coverage',
      'tcgfish.com · price-watch list',
      'cross-referencing citation density',
    ],
  },
  {
    id: 'synthesis',
    title: 'WEIGHTING / SYNTHESIS',
    pip: 'SYN▦',
    color: '#A09060',
    jp: false,
    trace: 'matrix',
    brands: [],
    details: [
      'Per-game weighting model',
      'Normalizing 9 signals',
      'Computing 0-100 score',
    ],
    log: [
      'WEIGHTS[pokemon] · loaded',
      'normalizing signal[].level / 5',
      'Σ (level · weight) / Σ weight',
      'rendering result · ETA <2s',
    ],
  },
];

const PHASE_MS = 4400;
const DETAIL_MS = 1450;
const TICK_MS = 120;
// Nominal scan duration. Progress bar fills linearly to 90% across this
// window, then eases asymptotically toward 99% if the scan keeps running
// (rare — usually the result lands inside the nominal window).
const NOMINAL_SCAN_MS = 35200; // 8 phases * 4400ms

const SOLARI_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789▲▼◆▸▤▦株渡日¥';

const TICKER_EN = '▲ TCGPLAYER ▼ EBAY ◆ LIMITLESS ▸ POKEBEACH ▲ GAME8 ▼ MTGGOLDFISH ◆ TCGFISH ▸ ';
const TICKER_JP = '¥ メルカリ ⛩ ヤフオク 株 ポケビーチ ¥ 価格 株 渡日 ¥ メルカリ ⛩ ヤフオク 株 ';

export default function LoadingTheater({ cardName, game }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // On mount, slide the theater into the middle of the viewport so the
  // whole thing is visible immediately instead of half-cut-off below the
  // fold. The user can still scroll away to browse — this only fires once.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const elapsed = now - start;
  const rawIdx = Math.floor(elapsed / PHASE_MS);
  let phaseIdx;
  if (rawIdx < PHASES.length) {
    phaseIdx = rawIdx;
  } else {
    const loop = [4, 5, 7];
    phaseIdx = loop[(rawIdx - PHASES.length) % loop.length];
  }
  const phase = PHASES[phaseIdx];
  const inPhase = elapsed - rawIdx * PHASE_MS;
  const detailIdx = Math.min(phase.details.length - 1, Math.floor(inPhase / DETAIL_MS));

  // Linear to 90% across the nominal window; asymptote toward 99% if the
  // scan runs long. Never reaches 100% — the parent unmounts on completion.
  const progress = elapsed < NOMINAL_SCAN_MS
    ? Math.min(0.9, (elapsed / NOMINAL_SCAN_MS) * 0.9)
    : 0.9 + 0.09 * (1 - Math.exp(-(elapsed - NOMINAL_SCAN_MS) / 18000));

  return (
    <div ref={rootRef} className="lt-canvas" data-jp={phase.jp || undefined}>
      <div className="lt-bg-grid" aria-hidden />
      <div className="lt-bg-vignette" aria-hidden />
      <KanjiBackdrop visible={phase.jp} />

      <div className="lt-top">
        <PhasePips activeIdx={rawIdx < PHASES.length ? rawIdx : PHASES.length - 1} />
        <ScanProgressBar percent={progress * 100} accent={phase.color} />
        <div className="lt-top-row">
          <CardSlate cardName={cardName} game={game} onImageLoad={setCardImageUrl} />
          <div className="lt-top-right">
            <LiveClock />
            <MarketsBadge />
          </div>
        </div>
      </div>

      <div className="lt-stage">
        <ScanLog phase={phase} phaseStartedAt={start + rawIdx * PHASE_MS} />
        <div className="lt-center">
          {/* Card art — large, dominant. Shows once image loads. */}
          {cardImageUrl && (
            <div style={{
              position: 'relative',
              height: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(ellipse at center, ${phase.color}18 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <img
                src={cardImageUrl}
                alt=""
                style={{
                  height: 160,
                  width: 'auto',
                  borderRadius: 6,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)`,
                  position: 'relative',
                  zIndex: 1,
                }}
              />
            </div>
          )}
          {phase.brands && phase.brands.length > 0 && (
            <BrandLogoStrip brands={phase.brands} />
          )}
          <SolariTitle text={phase.title} accentColor={phase.color} jp={phase.jp} />
          <DataTrace phase={phase} elapsed={inPhase} />
          <PhaseDetail phase={phase} detailIdx={detailIdx} />
        </div>
        <SignalGrid activePhaseId={phase.id} accent={phase.color} />
      </div>

      <div className="lt-tickers">
        <div className="lt-ticker lt-ticker--en">
          <span className="lt-ticker-inner lt-ticker-inner--en">
            {TICKER_EN.repeat(4)}
          </span>
        </div>
        <div className="lt-ticker lt-ticker--jp">
          <span className="lt-ticker-inner lt-ticker-inner--jp">
            {TICKER_JP.repeat(4)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Top chrome ──────────────────────────────────────────────────────────────

function ScanProgressBar({ percent, accent }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div style={{
      width: '100%',
      marginTop: 10,
      marginBottom: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: '#7A7368',
      }}>Scan</span>
      <div style={{
        flex: 1,
        height: 3,
        background: '#14161A',
        borderRadius: 1,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px #1A1D24',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${accent}77 0%, ${accent} 100%)`,
          boxShadow: `0 0 10px ${accent}88, 0 0 2px ${accent}`,
          transition: 'width 0.18s ease-out',
          borderRadius: 1,
        }} />
        {/* Leading edge — a hair brighter than the fill, suggests motion */}
        {pct > 1 && pct < 99 && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${pct}%`,
            transform: 'translateX(-2px)',
            width: 2,
            background: '#F5F1E8',
            opacity: 0.7,
            boxShadow: '0 0 6px #F5F1E8',
          }} />
        )}
      </div>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 700,
        color: '#C8C4BC',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 34,
        textAlign: 'right',
        letterSpacing: '0.04em',
      }}>{Math.round(pct)}%</span>
    </div>
  );
}

function PhasePips({ activeIdx }) {
  const idx = Math.max(0, Math.min(activeIdx, PHASES.length - 1));
  const active = PHASES[idx];
  return (
    <div className="lt-pips">
      {PHASES.map((p, i) => {
        const state = i < idx ? 'past' : i === idx ? 'now' : 'future';
        return (
          <div key={p.id} className={`lt-pip lt-pip--${state}`} style={{ '--pip-color': p.color }}>
            <span className="lt-pip-label">{p.pip}</span>
            <span className="lt-pip-rail" />
          </div>
        );
      })}
      <div className="lt-pip-meta">
        PHASE {String(idx + 1).padStart(2, '0')} / {String(PHASES.length).padStart(2, '0')} &middot; <span style={{ color: active.color, opacity: 0.85 }}>{active.title}</span>
      </div>
    </div>
  );
}

function CardSlate({ cardName, game, onImageLoad }) {
  const [imgUrl, setImgUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!cardName) return;
    fetchCardImage(cardName, game).then((url) => {
      if (!cancelled && url) {
        setImgUrl(url);
        onImageLoad?.(url);
      }
    });
    return () => { cancelled = true; };
  }, [cardName, game]);

  return (
    <div className="lt-cardslate">
      <div className="lt-cardslate-thumb" aria-hidden>
        {imgUrl ? (
          <img src={imgUrl} alt="" className="lt-cardslate-img" />
        ) : (
          <div className="lt-cardslate-placeholder">?</div>
        )}
      </div>
      <div className="lt-cardslate-meta">
        <div className="lt-cardslate-label">SCANNING</div>
        <div className="lt-cardslate-name">{cardName || '—'}</div>
      </div>
    </div>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 500);
    return () => clearInterval(id);
  }, []);
  const en = now.toLocaleTimeString('en-US', { hour12: false });
  const jp = now.toLocaleTimeString('ja-JP', { hour12: false, timeZone: 'Asia/Tokyo' });
  return (
    <div className="lt-clock">
      <div className="lt-clock-row">
        <span className="lt-clock-tz">PT</span>
        <span className="lt-clock-time">{en}</span>
      </div>
      <div className="lt-clock-row lt-clock-row--jp">
        <span className="lt-clock-tz">東京</span>
        <span className="lt-clock-time">{jp}</span>
      </div>
    </div>
  );
}

function MarketsBadge() {
  return (
    <div className="lt-markets">
      <span className="lt-markets-dot" />
      <span className="lt-markets-text">MARKETS · OPEN</span>
    </div>
  );
}

// ─── Center stage ────────────────────────────────────────────────────────────

function SolariTitle({ text, accentColor, jp }) {
  const targets = useMemo(() => Array.from(text), [text]);
  // prevTargetsRef holds the chars from the PREVIOUS text value. Because
  // useEffect runs after render, on the first render with new targets this ref
  // still contains the old set — so pre-cycle positions show the prior
  // character at low opacity instead of a bare placeholder dot.
  const prevTargetsRef = useRef([]);
  useEffect(() => { prevTargetsRef.current = targets; }, [targets]);

  const [, force] = useState(0);
  useEffect(() => {
    let raf;
    const tick = () => { force((n) => (n + 1) % 1e9); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const t0 = useMemo(() => Date.now(), [text]);
  const dt = Date.now() - t0;
  const FLIP_PER_LETTER = 720;
  const STAGGER = 38;

  return (
    <h2 className={`lt-solari ${jp ? 'lt-solari--jp' : ''}`} style={{ color: accentColor }}>
      {targets.map((ch, i) => {
        const startAt = i * STAGGER;
        const endAt = startAt + FLIP_PER_LETTER;
        let glyph = ch;
        let preCycle = false;
        if (dt < endAt) {
          if (dt < startAt) {
            preCycle = true;
            const prev = prevTargetsRef.current[i];
            glyph = (prev !== undefined && prev !== ' ') ? prev : (ch !== ' ' ? ch : ' ');
          } else {
            const cycleSpeed = 50;
            const idx = Math.floor((dt - startAt) / cycleSpeed);
            glyph = ch === ' ' ? ' '
              : SOLARI_GLYPHS[(i * 7 + idx) % SOLARI_GLYPHS.length];
          }
        }
        return (
          <span
            key={i}
            className={`lt-solari-cell ${dt >= endAt ? 'lt-solari-cell--locked' : 'lt-solari-cell--flipping'}`}
            data-space={ch === ' ' || undefined}
            style={preCycle ? { opacity: 0.28 } : undefined}
          >
            {glyph === ' ' ? ' ' : glyph}
          </span>
        );
      })}
    </h2>
  );
}

function DataTrace({ phase, elapsed }) {
  const c = phase.color;
  const drawProgress = Math.min(1, elapsed / 2200);
  const dashLen = 1000;
  const dashOffset = dashLen * (1 - drawProgress);

  return (
    <div className="lt-trace" key={phase.id}>
      <svg viewBox="0 0 360 80" width="100%" height="80" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${phase.id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={c} stopOpacity="0" />
            <stop offset="50%" stopColor={c} stopOpacity="0.95" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="40" x2="360" y2="40" stroke={c} strokeOpacity="0.12" strokeWidth="1" />
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1={i * 30 + 15} y1="38" x2={i * 30 + 15} y2="42" stroke={c} strokeOpacity="0.18" strokeWidth="1" />
        ))}
        <path
          d={tracePath(phase.trace)}
          fill="none"
          stroke={`url(#grad-${phase.id})`}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashLen}
          strokeDashoffset={dashOffset}
        />
        <circle cx={drawProgress * 360} cy={40 + traceY(phase.trace, drawProgress)} r="3" fill={c} opacity="0.9" />
      </svg>
    </div>
  );
}

function tracePath(kind) {
  switch (kind) {
    case 'sawtooth':
      return 'M 0 60 L 30 25 L 50 55 L 80 18 L 110 48 L 140 28 L 170 58 L 200 22 L 230 50 L 260 30 L 290 55 L 320 20 L 360 40';
    case 'wave':
      return 'M 0 40 C 30 10, 60 70, 90 40 C 120 10, 150 70, 180 40 C 210 10, 240 70, 270 40 C 300 10, 330 70, 360 40';
    case 'bracket':
      return 'M 0 30 L 60 30 L 60 50 L 120 50 L 120 30 L 180 30 L 180 60 L 240 60 L 240 25 L 300 25 L 300 50 L 360 50';
    case 'kanji':
      return 'M 30 20 L 80 20 M 50 12 L 50 70 M 20 40 L 90 40 M 110 25 C 140 25, 170 25, 200 25 L 200 65 M 220 18 L 280 18 L 280 65 L 340 65';
    case 'yen':
      return 'M 20 25 L 50 50 L 80 25 M 50 50 L 50 70 M 20 55 L 80 55 M 20 65 L 80 65 M 110 40 L 360 40';
    case 'columns':
      return 'M 0 65 L 30 65 L 30 18 L 60 18 L 60 65 L 100 65 L 100 30 L 130 30 L 130 65 L 170 65 L 170 22 L 200 22 L 200 65 L 240 65 L 240 35 L 270 35 L 270 65 L 310 65 L 310 25 L 340 25 L 340 65 L 360 65';
    case 'matrix':
      return 'M 0 70 Q 90 70, 180 40 T 360 40 M 0 10 Q 90 10, 180 40 T 360 40';
    default:
      return 'M 0 40 L 360 40';
  }
}

function traceY(kind, t) {
  switch (kind) {
    case 'sawtooth': return Math.sin(t * 18) * 18;
    case 'wave': return Math.sin(t * 8 * Math.PI) * 22;
    case 'kanji': return -10 + Math.sin(t * 4) * 8;
    case 'yen': return Math.sin(t * 8) * 16;
    case 'matrix': return Math.sin(t * 4) * 25 - 5;
    default: return 0;
  }
}

function PhaseDetail({ phase, detailIdx }) {
  const detail = phase.details[detailIdx];
  return (
    <div
      key={phase.id + ':' + detailIdx}
      className={`lt-detail ${phase.jp ? 'lt-detail--jp' : ''}`}
    >
      <span className="lt-detail-marker">{phase.jp ? '》' : '>'}</span>
      <span className="lt-detail-text">{detail}</span>
      <span className="lt-detail-cursor">_</span>
    </div>
  );
}

// ─── Left rail: scan log ─────────────────────────────────────────────────────

function ScanLog({ phase, phaseStartedAt }) {
  const [tickNow, setTickNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 220);
    return () => clearInterval(id);
  }, []);

  const elapsed = tickNow - phaseStartedAt;
  const visibleCount = Math.min(phase.log.length, Math.floor(elapsed / 1000) + 1);
  const visible = phase.log.slice(0, visibleCount);

  const tsAt = (idx) => {
    const d = new Date(phaseStartedAt + idx * 1000);
    return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0').slice(0, 2);
  };

  return (
    <aside className="lt-log">
      <div className="lt-log-header">
        <span className="lt-log-title">INFO</span>
        <span className="lt-log-host" style={{ color: phase.color, opacity: 0.7 }}>{phase.id}.signal.local</span>
      </div>
      <div className="lt-log-body">
        {visible.map((line, i) => (
          <div key={phase.id + ':' + i} className="lt-log-line" style={{ '--i': i }}>
            <span className="lt-log-ts">{tsAt(i)}</span>
            <span className="lt-log-text">{line}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ─── Right rail: 9-signal grid ───────────────────────────────────────────────

const SIGNAL_LATTICE = [
  { key: 'creator',     label: 'CRE', phaseId: 'creators' },
  { key: 'community',   label: 'COM', phaseId: 'creators' },
  { key: 'ip_momentum', label: 'IPM', phaseId: 'creators' },
  { key: 'editorial',   label: 'EDT', phaseId: 'editorial' },
  { key: 'competitive', label: 'CMP', phaseId: 'tournament' },
  { key: 'scarcity',    label: 'SCR', phaseId: 'synthesis' },
  { key: 'jp_price',    label: '¥PR', phaseId: 'mercari' },
  { key: 'jp_hype',     label: '熱',  phaseId: 'mercari' },
  { key: 'jp_release',  label: '先',  phaseId: 'japan-crossing' },
];

function SignalGrid({ activePhaseId, accent }) {
  return (
    <aside className="lt-grid">
      <div className="lt-grid-header">
        <span className="lt-grid-title">9 SIGNALS</span>
      </div>
      <div className="lt-signal-list">
        {SIGNAL_LATTICE.map((s) => {
          const active = s.phaseId === activePhaseId;
          const fullLabel = SIGNAL_TYPES[s.key]?.label || s.label;
          return (
            <div
              key={s.key}
              className={`lt-signal-item ${active ? 'lt-signal-item--active' : ''}`}
              style={{ '--cell-color': active ? accent : '#605C54' }}
              title={fullLabel}
            >
              <span className="lt-signal-item-dot" />
              <span className="lt-signal-item-label">{fullLabel}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ─── Brand logo strip ────────────────────────────────────────────────────────

function BrandLogoStrip({ brands }) {
  return (
    <div className="lt-brands">
      {brands.map((b, i) => (
        <div
          key={b}
          className="lt-brand-cell"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <BrandIcon brand={b} size={28} />
        </div>
      ))}
    </div>
  );
}

// ─── JP kanji backdrop ───────────────────────────────────────────────────────

function KanjiBackdrop({ visible }) {
  return (
    <div
      className={`lt-kanji-backdrop ${visible ? 'lt-kanji-backdrop--on' : ''}`}
      aria-hidden
    >
      株
    </div>
  );
}
