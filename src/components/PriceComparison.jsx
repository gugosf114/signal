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

export default function PriceComparison({ data }) {
  const isMobile = useIsMobile();
  if (!data) return null;

  const align = alignMeta(data.signal_vs_market);
  const checked = (() => {
    const date = new Date(data.price_checked_at || '');
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();
  const priceNote = [data.price_source, checked ? `checked ${checked}` : null].filter(Boolean).join(' · ');

  const outerStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? 'minmax(0, 1.45fr) minmax(0, 0.8fr)' : 'minmax(0, 1.6fr) minmax(0, 0.7fr)',
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

      {/* ALIGNMENT (was Sig·Mkt) */}
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
