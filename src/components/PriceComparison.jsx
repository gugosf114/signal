import React from 'react';
import { BrandIcon } from '../config/brandIcons';
import { useIsMobile } from '../hooks/useIsMobile';

function trendMeta(trend) {
  if (!trend) return { sym: '—', color: '#605C54' };
  const t = trend.toLowerCase();
  if (t.includes('up') || t.includes('rising') || t.includes('increas'))
    return { sym: '▲', color: '#608870' };
  if (t.includes('down') || t.includes('falling') || t.includes('decreas'))
    return { sym: '▼', color: '#C44040' };
  return { sym: '►', color: '#A09060' };
}

function alignMeta(val) {
  if (!val) return { color: '#605C54', sym: '—' };
  const v = val.toLowerCase();
  if (v.includes('agree')) return { color: '#608870', sym: '✓' };
  if (v.includes('disagree')) return { color: '#C44040', sym: '✗' };
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

  const trend = trendMeta(data.trend_30d);
  const align = alignMeta(data.signal_vs_market);

  // Three cells since the yen price was removed: EN price, 30-day trend,
  // alignment. On mobile EN takes the full first row and the two narrow cells
  // split the second, so the price never competes for width with a symbol.
  const outerStyle = isMobile ? {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    borderTop: '1px solid #1A1D24',
    borderBottom: '1px solid #1A1D24',
    marginBottom: 40,
    background: '#0B0D10',
  } : {
    display: 'flex',
    borderTop: '1px solid #1A1D24',
    borderBottom: '1px solid #1A1D24',
    marginBottom: 40,
    background: '#0B0D10',
  };

  return (
    <div className="fade-slide-up" style={outerStyle}>
      {/* EN */}
      <div style={{
        ...(isMobile ? { gridColumn: '1 / 3' } : { flex: '1.4' }),
        padding: isMobile ? '12px 14px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: '#7A7368' }}>EN Price</div>
        <div style={{ ...valStyle, fontSize: 16, color: '#E8E4DC' }}>
          {data.en_price || '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <BrandIcon brand="tcgplayer" size={11} />
          <span style={{ fontSize: 9, color: '#605C54', fontFamily: "'JetBrains Mono', monospace" }}>TCGPlayer</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: '#494640' }} />
          <BrandIcon brand="ebay" size={11} />
          <span style={{ fontSize: 9, color: '#605C54', fontFamily: "'JetBrains Mono', monospace" }}>eBay</span>
        </div>
      </div>

      {/* 30-DAY TREND (was 30D) */}
      <div style={{
        ...(isMobile ? { gridColumn: '1 / 2', borderTop: '1px solid #1A1D24', borderRight: '1px solid #1A1D24' } : { flex: '0.8' }),
        padding: isMobile ? '10px 10px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: '#7A7368' }}>30-Day Trend</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            className={trend.sym === '▲' ? 'trend-bounce-up' : trend.sym === '▼' ? 'trend-bounce-down' : ''}
            style={{ ...valStyle, fontSize: 14, color: trend.color }}
          >
            {trend.sym}
          </span>
        </div>
        <div style={{ fontSize: 9, color: trend.color, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
          {data.trend_30d || '—'}
        </div>
      </div>

      {!isMobile && <div style={{ width: 1, background: '#1A1D24' }} />}

      {/* ALIGNMENT (was Sig·Mkt) */}
      <div style={{
        ...(isMobile ? { gridColumn: '2 / 3', borderTop: '1px solid #1A1D24' } : { flex: '0.8' }),
        padding: isMobile ? '10px 10px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: '#7A7368' }}>Alignment</div>
        <span style={{ ...valStyle, fontSize: 14, color: align.color }}>{align.sym}</span>
        <div style={{ fontSize: 9, color: align.color, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
          {data.signal_vs_market || '—'}
        </div>
      </div>
    </div>
  );
}
