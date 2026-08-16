import React from 'react';
import { getScoreLabel, GAME_LABELS, WEIGHTS } from '../config/signals';
import { printingLabel } from '../services/printing';

// ─── Premium PDF layout ──────────────────────────────────────────────────────
// Editorial light theme. Cream paper, dark ink, JP-red hairline accents.
// Captured off-screen at scan-result-save time so html2pdf renders a clean
// document instead of the dark live dashboard.

const PAPER     = '#FAF7F0';
const PAPER_INK = '#FDFBF5';
const INK_BODY  = '#1A1A1A';
const INK_MID   = '#7A7368';
const INK_MUTE  = '#A8A498';
const INK_FAINT = '#A8A49C';
const RULE_HAIR = '#D8D4CC';
const RULE_THIN = '#E8E4DC';
const BRAND_RED = '#C44040';

const SIGNAL_LABEL = {
  creator:     'Creator Attention',
  community:   'Community Volume',
  ip_momentum: 'Franchise Buzz',
  editorial:   'Editorial Attention',
  competitive: 'Competitive Demand',
  scarcity:    'Print Scarcity',
  jp_hype:     'JP Community Buzz',
  jp_release:  'JP Release Timeline',
};

const SIGNAL_ORDER = [
  'creator', 'scarcity', 'competitive', 'ip_momentum', 'community',
  'editorial', 'jp_hype', 'jp_release',
];

const fmtUsd = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const fmtDate = (d) => d.toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

export default function PdfReport({ result, score, cardImageUrl }) {
  if (!result) return null;

  const gameKey   = (result.game || 'pokemon').toLowerCase();
  const gameMeta  = GAME_LABELS[gameKey] || GAME_LABELS.pokemon;
  const scoreMeta = getScoreLabel(score || 0);
  const weights   = WEIGHTS[gameKey] || WEIGHTS.pokemon;

  const now = new Date();
  const bin = Array.isArray(result.ebay_listings?.buy_it_now) ? result.ebay_listings.buy_it_now : [];
  const auc = Array.isArray(result.ebay_listings?.auction)     ? result.ebay_listings.auction     : [];
  const listings = [
    ...bin.slice(0, 2).map((l) => ({ ...l, _type: 'BIN' })),
    ...auc.slice(0, 1).map((l) => ({ ...l, _type: 'AUC' })),
  ];

  return (
    <div style={{
      width: 720,
      background: PAPER,
      color: INK_BODY,
      fontFamily: "'Instrument Serif', Georgia, serif",
      padding: '36px 40px 28px',
      boxSizing: 'border-box',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: `2px solid ${BRAND_RED}`,
        paddingTop: 14,
        marginBottom: 30,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <div>
          <span style={{
            fontFamily: "'Noto Sans JP', sans-serif",
            fontWeight: 800,
            fontSize: 26,
            color: BRAND_RED,
            letterSpacing: '-0.02em',
          }}>株</span>
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 26,
            color: INK_BODY,
            marginLeft: 8,
            letterSpacing: '-0.02em',
          }}>Signal</span>
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 12,
            color: INK_MUTE,
            marginTop: 2,
            letterSpacing: '0.01em',
          }}>Trading card intelligence</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 10,
            color: INK_MUTE,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {fmtDate(now)}
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', Menlo, monospace",
            fontSize: 9,
            color: INK_FAINT,
            marginTop: 3,
            letterSpacing: '0.04em',
          }}>
            Scan report · {gameMeta.label}
          </div>
        </div>
      </div>

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 32, marginBottom: 26 }}>
        {cardImageUrl && (
          <img
            src={cardImageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: 200,
              height: 'auto',
              borderRadius: 4,
              flexShrink: 0,
              boxShadow: '0 6px 28px rgba(0,0,0,0.10)',
              border: `1px solid ${RULE_HAIR}`,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
          }}>
            <span style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: 9,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: INK_MUTE,
            }}>{gameMeta.label}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: INK_FAINT }} />
            <span style={{
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: 9,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: scoreMeta.color,
            }}>{scoreMeta.label}</span>
          </div>
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 32,
            color: INK_BODY,
            lineHeight: 1.05,
            marginBottom: 14,
            letterSpacing: '-0.01em',
          }}>
            {result.card_name}
          </div>
          {/* An exported report that names a card but not its printing is a
              report about a price nobody can look up. */}
          {printingLabel(result.printing) && (
            <div style={{
              fontFamily: "'JetBrains Mono', Menlo, monospace",
              fontSize: 11,
              color: INK_FAINT,
              marginTop: -8,
              marginBottom: 14,
            }}>
              {printingLabel(result.printing)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <span style={{
              fontFamily: "'JetBrains Mono', Menlo, monospace",
              fontWeight: 800,
              fontSize: 78,
              color: scoreMeta.color,
              lineHeight: 1,
              letterSpacing: '-0.04em',
            }}>{score ?? 0}</span>
            <span style={{
              fontFamily: "'JetBrains Mono', Menlo, monospace",
              fontSize: 20,
              color: INK_FAINT,
              fontWeight: 500,
            }}>/100</span>
          </div>
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 14,
            color: INK_MID,
            lineHeight: 1.4,
          }}>
            {scoreMeta.blurb}
          </div>
        </div>
      </div>

      {/* ─── SUMMARY ──────────────────────────────────────────────────────── */}
      {result.summary && (
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 13,
          lineHeight: 1.6,
          color: INK_BODY,
          marginBottom: 28,
          maxWidth: 640,
        }}>
          {result.summary}
        </div>
      )}

      {/* ─── PRICES ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 0,
        borderTop: `1px solid ${RULE_HAIR}`,
        borderBottom: `1px solid ${RULE_HAIR}`,
        padding: '14px 0',
        marginBottom: 28,
      }}>
        <PriceCell label="EN Price" value={result.prices?.en_price} />
        <PriceCell
          label="30-Day Trend"
          value={result.prices?.trend_30d}
          smallFont
        />
        <PriceCell
          label="Signal vs Market"
          value={result.prices?.signal_vs_market}
          smallFont
        />
      </div>

      {/* ─── EBAY LISTINGS ────────────────────────────────────────────────── */}
      {listings.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionHeader>Active Listings · eBay</SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listings.map((l, i) => (
              <ListingRow key={i} listing={l} />
            ))}
          </div>
        </div>
      )}

      {/* ─── SIGNAL SCORECARD — all 9, fully expanded with citations ──────── */}
      <div style={{ marginBottom: 24 }}>
        <SectionHeader>Signal Scorecard</SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {SIGNAL_ORDER.map((key) => {
            const sig = (result.signals || []).find((s) => s.key === key);
            const weight = weights[key] || 0;
            return (
              <SignalBlock
                key={key}
                label={SIGNAL_LABEL[key]}
                level={sig?.level ?? 0}
                detail={sig?.detail || '—'}
                sources={sig?.sources || []}
                dropped={sig?.dropped || 0}
                weightPct={Math.round(weight * 100)}
              />
            );
          })}
        </div>
      </div>

      {/* ─── FOOTER ───────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 24,
        paddingTop: 14,
        borderTop: `1px solid ${RULE_HAIR}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontFamily: "'Syne', sans-serif",
        fontSize: 9,
        color: INK_FAINT,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>
        <span>
          <span style={{ color: BRAND_RED, fontFamily: "'Noto Sans JP', sans-serif", fontWeight: 800, textTransform: 'none' }}>株</span>
          <span style={{ marginLeft: 6 }}>Signal · TCG Intelligence</span>
        </span>
        <span style={{
          fontStyle: 'italic',
          fontFamily: "'Instrument Serif', Georgia, serif",
          textTransform: 'none',
          letterSpacing: 0,
          fontSize: 11,
          color: INK_MUTE,
        }}>
          Not financial advice
        </span>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    }}>
      <span style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        fontSize: 9,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: INK_MID,
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: RULE_THIN }} />
    </div>
  );
}

function PriceCell({ label, value, color, smallFont }) {
  return (
    <div style={{ padding: '0 18px' }}>
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        fontSize: 8,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: INK_MUTE,
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', Menlo, monospace",
        fontSize: smallFont ? 11 : 13,
        fontWeight: 600,
        color: color || INK_BODY,
        lineHeight: 1.35,
        whiteSpace: 'pre-wrap',
      }}>{value || '—'}</div>
    </div>
  );
}

function ListingRow({ listing }) {
  const isAuction = listing._type === 'AUC';
  const price = isAuction
    ? fmtUsd(listing.current_bid_usd)
    : fmtUsd(listing.price_usd);
  return (
    <div style={{
      display: 'flex',
      gap: 14,
      padding: '10px 12px',
      background: PAPER_INK,
      borderLeft: `2px solid ${isAuction ? BRAND_RED : '#608870'}`,
      borderRadius: 2,
    }}>
      <div style={{ minWidth: 90, flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: 8,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: isAuction ? BRAND_RED : '#3F6850',
          marginBottom: 4,
        }}>{isAuction ? 'Auction' : 'Buy It Now'}</div>
        <div style={{
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontWeight: 700,
          fontSize: 15,
          color: INK_BODY,
        }}>{price}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 10,
          color: INK_MID,
          lineHeight: 1.45,
          marginBottom: 4,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>{listing.title || '—'}</div>
        <div style={{
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 9,
          color: INK_MUTE,
        }}>
          {listing.condition || 'condition unknown'}
          {!isAuction && listing.shipping && listing.shipping !== 'unknown' && ` · ${listing.shipping} ship`}
          {isAuction && typeof listing.bid_count === 'number' && ` · ${listing.bid_count} bids`}
          {isAuction && listing.time_remaining && ` · ${listing.time_remaining}`}
          {listing.seller && ` · ${listing.seller}`}
        </div>
      </div>
    </div>
  );
}

function SignalBlock({ label, level, detail, sources, dropped = 0, weightPct }) {
  const bars = Array.from({ length: 5 }).map((_, i) => i < level);
  const realSources = (sources || []).filter((s) => s && (s.url || s.title));

  return (
    <div style={{
      padding: '14px 0 16px',
      borderBottom: `1px solid ${RULE_THIN}`,
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{
          minWidth: 140,
          fontFamily: "'Syne', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          color: INK_BODY,
          letterSpacing: '0.02em',
        }}>{label}</div>
        <div style={{ display: 'flex', gap: 3, minWidth: 72 }}>
          {bars.map((on, i) => (
            <div key={i} style={{
              width: 12,
              height: 8,
              borderRadius: 1,
              background: on ? INK_BODY : RULE_HAIR,
            }} />
          ))}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 10,
          color: INK_FAINT,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>{level}/5</div>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 10,
          color: INK_MUTE,
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>{weightPct}%</div>
      </div>

      {/* Single-line detail */}
      {detail && detail !== '—' && (
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 12,
          color: INK_MID,
          lineHeight: 1.45,
          marginBottom: realSources.length ? 10 : 0,
        }}>{detail}</div>
      )}

      {/* All sources, each fully expanded */}
      {realSources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {realSources.map((src, i) => <SourceLine key={i} src={src} />)}
        </div>
      )}

      {/* Distinguish "nothing was found" from "citations were fabricated and
          rejected" — on an audit document those are not the same statement. */}
      {realSources.length === 0 && (
        <div style={{
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 9,
          color: dropped > 0 ? BRAND_RED : INK_FAINT,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {dropped > 0
            ? `${dropped} citation${dropped === 1 ? '' : 's'} rejected — URL could not be verified against a retrieval.`
            : 'No sources surfaced — score reflects absence of signal.'}
        </div>
      )}

      {realSources.length > 0 && dropped > 0 && (
        <div style={{
          marginTop: 8,
          fontFamily: "'JetBrains Mono', Menlo, monospace",
          fontSize: 9,
          color: BRAND_RED,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {dropped} further citation{dropped === 1 ? '' : 's'} rejected — URL could not be verified.
        </div>
      )}
    </div>
  );
}

function SourceLine({ src }) {
  const impColor =
    src.implication === 'up'   ? '#3F6850' :
    src.implication === 'down' ? BRAND_RED :
                                 '#8A7A4A';
  const impGlyph =
    src.implication === 'up'   ? '▲' :
    src.implication === 'down' ? '▼' :
                                 '~';
  const meta = [
    src.type,
    src.date,
    src.audience,
    src.reach && src.reach !== 'unknown' ? src.reach : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      paddingLeft: 12,
      borderLeft: `2px solid ${impColor}`,
    }}>
      <div style={{
        minWidth: 10,
        fontFamily: "'JetBrains Mono', Menlo, monospace",
        fontSize: 11,
        color: impColor,
        fontWeight: 700,
        lineHeight: 1.4,
        paddingTop: 1,
      }}>{impGlyph}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Source · type · date · audience */}
        <div style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 9.5,
          color: INK_BODY,
          fontWeight: 700,
          letterSpacing: '0.04em',
          marginBottom: 3,
        }}>
          {src.source || 'Source'}
          {meta && (
            <span style={{
              color: INK_FAINT,
              fontWeight: 400,
              marginLeft: 6,
              fontFamily: "'JetBrains Mono', Menlo, monospace",
              fontSize: 9,
              letterSpacing: '0.02em',
            }}>· {meta}</span>
          )}
        </div>
        {/* Title in italic serif, in quotes */}
        {src.title && (
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 11.5,
            color: INK_BODY,
            lineHeight: 1.4,
            marginBottom: src.summary ? 3 : 0,
          }}>“{src.title}”</div>
        )}
        {/* Summary — model's one-line take on the source */}
        {src.summary && (
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 10.5,
            color: INK_MID,
            lineHeight: 1.5,
          }}>{src.summary}</div>
        )}
        {/* URL line — tiny mono, for citation provenance */}
        {src.url && (
          <div style={{
            fontFamily: "'JetBrains Mono', Menlo, monospace",
            fontSize: 8,
            color: INK_FAINT,
            marginTop: 3,
            wordBreak: 'break-all',
            letterSpacing: '0.02em',
          }}>{src.url}</div>
        )}
      </div>
    </div>
  );
}
