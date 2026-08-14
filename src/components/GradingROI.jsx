import React from 'react';

// ─── Grading ROI ─────────────────────────────────────────────────────────────
// The one place the scorecard turns into money: raw price → PSA 10 estimate,
// minus grading cost, equals net. Shown as visible arithmetic so the number can
// be checked rather than trusted.
//
// Palette note: this block previously used its own greys (#141414 / #888 /
// #ddd) and a bright material green, which made it the only panel on the page
// that didn't belong to the app. It now uses the locked tokens — near-black
// canvas, the muted text graduation, and the same restrained green/red the
// implication arrows use elsewhere.

const SURFACE   = '#0E1014';
const HAIRLINE  = '#1A1D24';
const INK       = '#E8E4DC';
const INK_MID   = '#92897C';
const INK_MUTE  = '#7A7368';
const INK_FAINT = '#605C54';
const POSITIVE  = '#608870';
const NEGATIVE  = '#C44040';
const WARM      = '#A09060';

export default function GradingROI({ data }) {
  if (!data || data.confidence === 'insufficient_data') return null;

  const { raw_price_usd, psa10_est_usd, grading_cost_usd, net_roi_usd, net_roi_pct, verdict, confidence, note } = data;

  const verdictStyle = {
    worth_grading:     { color: POSITIVE, label: 'Worth Grading' },
    marginal:          { color: WARM,     label: 'Marginal' },
    not_worth_grading: { color: NEGATIVE, label: 'Skip Grading' },
  }[verdict] || { color: INK_MUTE, label: '—' };

  const roiPositive = net_roi_usd > 0;

  return (
    <div className="fade-slide-up" style={{
      background: SURFACE,
      border: `1px solid ${HAIRLINE}`,
      borderRadius: 3,
      padding: '18px 20px',
      marginBottom: 40,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
      }}>
        <span style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '0.18em',
          fontFamily: "'Syne', sans-serif",
          textTransform: 'uppercase',
          color: INK_MUTE,
        }}>
          Grading ROI
        </span>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${HAIRLINE}, transparent)` }} />
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.16em',
          fontFamily: "'Syne', sans-serif",
          textTransform: 'uppercase',
          color: verdictStyle.color,
        }}>
          {verdictStyle.label}
        </span>
      </div>

      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: note || confidence === 'low' ? 12 : 0,
      }}>
        <Cell label="Raw" value={raw_price_usd != null ? `$${raw_price_usd}` : '—'} />
        <Operator>→</Operator>
        <Cell label="PSA 10 est." value={psa10_est_usd != null ? `$${psa10_est_usd}` : '—'} />
        <Operator>−</Operator>
        <Cell label="Grading" value={grading_cost_usd != null ? `$${grading_cost_usd}` : '~$25'} dim />
        <Operator>=</Operator>
        <Cell
          label="Net"
          value={net_roi_usd != null ? `${roiPositive ? '+' : ''}$${net_roi_usd}` : '—'}
          sub={net_roi_pct != null ? `${roiPositive ? '+' : ''}${net_roi_pct}%` : null}
          highlight={roiPositive ? POSITIVE : NEGATIVE}
        />
      </div>

      {note && (
        <div style={{
          fontSize: 13,
          color: INK_MID,
          fontFamily: "'Instrument Serif', serif",
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}>{note}</div>
      )}

      {confidence === 'low' && (
        <div style={{
          fontSize: 11,
          color: WARM,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.04em',
          marginTop: 6,
        }}>
          Low confidence — PSA 10 estimate from model knowledge, not a retrieved sale. Verify on eBay sold.
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, sub, highlight, dim }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
      <div style={{
        fontSize: 17,
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '-0.02em',
        color: highlight || (dim ? INK_FAINT : INK),
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: 11,
          color: highlight || INK_MID,
          fontFamily: "'JetBrains Mono', monospace",
        }}>{sub}</div>
      )}
      <div style={{
        fontSize: 8,
        color: INK_FAINT,
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        marginTop: 3,
      }}>
        {label}
      </div>
    </div>
  );
}

function Operator({ children }) {
  return (
    <div style={{
      color: INK_FAINT,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      paddingBottom: 12,
    }}>{children}</div>
  );
}
