import React from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

function alignMeta(val) {
  if (!val) return { color: 'var(--signal-text-muted)', sym: '—' };
  const v = val.toLowerCase();
  if (v === 'disagree' || v.includes('not agree') || v.includes('conflict')) return { color: '#C44040', sym: '✗' };
  if (v === 'agree' || /\bagree(?:s|d|ment)?\b/.test(v)) return { color: '#608870', sym: '✓' };
  return { color: '#A09060', sym: '~' };
}

const labelStyle = {
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: '0.16em',
  fontFamily: "'Syne', sans-serif",
  textTransform: 'uppercase',
  marginBottom: 4,
};

const valStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 600,
  lineHeight: 1.2,
};

function moveMeta(value) {
  if (value === null || value === undefined) return { color: 'var(--signal-text-muted)', text: '—' };
  const text = `${value > 0 ? '+' : ''}${value}%`;
  if (value >= 3) return { color: '#608870', text };
  if (value <= -3) return { color: '#C44040', text };
  return { color: '#A09060', text };
}

// Ninety days of the exact SKU's market price, drawn as one thin line.
function Sparkline({ points, color }) {
  const values = (points || []).map((point) => Number(point[1])).filter((value) => Number.isFinite(value) && value > 0);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((value, index) => `${((index / (values.length - 1)) * 100).toFixed(1)},${(18 - ((value - min) / span) * 16).toFixed(1)}`);
  return (
    <svg className="price-sparkline" viewBox="0 0 100 20" preserveAspectRatio="none" width="100%" height="18" aria-hidden style={{ display: 'block', marginTop: 4 }}>
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function PriceComparison({ data }) {
  const isMobile = useIsMobile();
  if (!data) return null;

  const align = alignMeta(data.signal_vs_market);
  const checked = (() => {
    const date = new Date(data.price_checked_at || '');
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();
  const priceNote = [data.price_source, checked ? `checked ${checked}` : null].filter(Boolean).join(' · ');

  const history = data.history || null;
  const move30 = moveMeta(history?.change30);
  const move90 = moveMeta(history?.change90);
  const historyNote = history
    ? [history.variant, history.condition, history.sold30 != null ? `${history.sold30} sold · 30d` : null].filter(Boolean).join(' · ')
    : 'no exact history';

  const outerStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile
      ? 'minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 0.75fr) minmax(0, 0.65fr)'
      : 'minmax(0, 1.4fr) minmax(0, 0.9fr) minmax(0, 0.7fr) minmax(0, 0.6fr)',
    borderTop: '1px solid #1A1D24',
    borderBottom: '1px solid #1A1D24',
    marginBottom: 40,
    background: 'var(--signal-panel)',
  };

  return (
    <div className="price-strip fade-slide-up" style={outerStyle}>
      {/* Market price. The provider varies by game, so this row does not stamp
          a marketplace logo onto a number that may have come from elsewhere. */}
      <div className="price-cell price-cell--market" style={{
        padding: isMobile ? '12px 14px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: 'var(--signal-text-secondary)' }}>Market Price</div>
        <div className="price-value" style={{ ...valStyle, fontSize: 16, color: '#E8E4DC' }}>
          {data.en_price || 'No exact price'}
        </div>
        {priceNote && <div style={{ fontSize: 9, color: 'var(--signal-text-muted)', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>{priceNote}</div>}
      </div>

      {/* 30-DAY and 90-DAY — TCGplayer market price for this exact SKU. Absent
          means no product id, never an estimate. */}
      <div className="price-cell price-cell--move30" style={{
        borderLeft: '1px solid #1A1D24',
        padding: isMobile ? '10px 10px' : '14px 16px',
        minWidth: 0,
      }}>
        <div style={{ ...labelStyle, color: 'var(--signal-text-secondary)' }}>30-Day</div>
        <div className="price-value" style={{ ...valStyle, fontSize: 14, color: move30.color }}>{move30.text}</div>
        <Sparkline points={history?.points} color={move30.color} />
        <div style={{ fontSize: 8, color: 'var(--signal-text-muted)', marginTop: 3, fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{historyNote}</div>
      </div>
      <div className="price-cell price-cell--move90" style={{
        borderLeft: '1px solid #1A1D24',
        padding: isMobile ? '10px 8px' : '14px 16px',
        minWidth: 0,
      }}>
        <div style={{ ...labelStyle, color: 'var(--signal-text-secondary)' }}>90-Day</div>
        <div className="price-value" style={{ ...valStyle, fontSize: 14, color: move90.color }}>{move90.text}</div>
      </div>

      {/* ALIGNMENT — score direction against the real 30-day move */}
      <div className="price-cell price-cell--alignment" style={{
        borderLeft: '1px solid #1A1D24',
        padding: isMobile ? '10px 10px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: 'var(--signal-text-secondary)' }}>Alignment</div>
        <span style={{ ...valStyle, fontSize: 14, color: align.color }}>{align.sym}</span>
        <div style={{ fontSize: 9, color: align.color, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
          {data.signal_vs_market || '—'}
        </div>
      </div>
    </div>
  );
}
