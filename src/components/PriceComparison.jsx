import React from 'react';
import { BrandIcon } from '../config/brandIcons';
import { useIsMobile } from '../hooks/useIsMobile';

function trendMeta(trend) {
  if (!trend) return { sym: '—', color: '#3A3830' };
  const t = trend.toLowerCase();
  if (t.includes('up') || t.includes('rising') || t.includes('increas'))
    return { sym: '▲', color: '#608870' };
  if (t.includes('down') || t.includes('falling') || t.includes('decreas'))
    return { sym: '▼', color: '#C44040' };
  return { sym: '►', color: '#A09060' };
}

function alignMeta(val) {
  if (!val) return { color: '#3A3830', sym: '—' };
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

  // Mobile: 6-column grid. Row 1: EN (cols 1-3) + JP (cols 4-6).
  // Row 2: ARBITRAGE (1-3) + 30-DAY TREND (3-5) + ALIGNMENT (5-7).
  const outerStyle = isMobile ? {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
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
        ...(isMobile ? { gridColumn: '1 / 4', borderRight: '1px solid #1A1D24' } : { flex: '1.2' }),
        padding: isMobile ? '12px 14px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: '#4A4840' }}>EN Price</div>
        <div style={{ ...valStyle, fontSize: 16, color: '#E8E4DC' }}>
          {data.en_price || '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <BrandIcon brand="tcgplayer" size={11} />
          <span style={{ fontSize: 9, color: '#3A3830', fontFamily: "'JetBrains Mono', monospace" }}>TCGPlayer</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: '#2A2820' }} />
          <BrandIcon brand="ebay" size={11} />
          <span style={{ fontSize: 9, color: '#3A3830', fontFamily: "'JetBrains Mono', monospace" }}>eBay</span>
        </div>
      </div>

      {!isMobile && <div style={{ width: 1, background: '#1A1D24' }} />}

      {/* JP */}
      <div style={{
        ...(isMobile ? { gridColumn: '4 / 7' } : { flex: '1.2' }),
        padding: isMobile ? '12px 14px' : '14px 16px',
        background: 'rgba(196, 64, 64, 0.03)',
      }}>
        <div style={{ ...labelStyle, color: '#8A4040', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, opacity: 0.6 }}>¥</span>
          JP Price
        </div>
        <div style={{ ...valStyle, fontSize: 16, color: '#C44040' }}>
          {data.jp_price || '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <BrandIcon brand="mercari" size={11} />
          <span style={{ fontSize: 9, color: '#8A4040', fontFamily: "'JetBrains Mono', monospace" }}>メルカリ</span>
          <span style={{ width: 2, height: 2, borderRadius: '50%', background: '#4A2020' }} />
          <BrandIcon brand="rakuten" size={11} />
          <span style={{ fontSize: 9, color: '#8A4040', fontFamily: "'JetBrains Mono', monospace" }}>Rakuten</span>
        </div>
      </div>

      {!isMobile && <div style={{ width: 1, background: '#1A1D24' }} />}

      {/* JP COMP (was Arbitrage, was JP↔EN Gap) — sentiment proxy, not a tradeable spread */}
      <div style={{
        ...(isMobile ? { gridColumn: '1 / 3', borderTop: '1px solid #1A1D24', borderRight: '1px solid #1A1D24' } : { flex: '1.5' }),
        padding: isMobile ? '10px 10px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: '#4A4840' }}>JP Comp</div>
        <div style={{
          ...valStyle,
          fontSize: isMobile ? 11 : 12,
          color: '#6B6860',
          lineHeight: 1.5,
        }}>
          {data.jp_en_gap || '—'}
        </div>
      </div>

      {!isMobile && <div style={{ width: 1, background: '#1A1D24' }} />}

      {/* 30-DAY TREND (was 30D) */}
      <div style={{
        ...(isMobile ? { gridColumn: '3 / 5', borderTop: '1px solid #1A1D24', borderRight: '1px solid #1A1D24' } : { flex: '0.8' }),
        padding: isMobile ? '10px 10px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: '#4A4840' }}>30-Day Trend</div>
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
        ...(isMobile ? { gridColumn: '5 / 7', borderTop: '1px solid #1A1D24' } : { flex: '0.8' }),
        padding: isMobile ? '10px 10px' : '14px 16px',
      }}>
        <div style={{ ...labelStyle, color: '#4A4840' }}>Alignment</div>
        <span style={{ ...valStyle, fontSize: 14, color: align.color }}>{align.sym}</span>
        <div style={{ fontSize: 9, color: align.color, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
          {data.signal_vs_market || '—'}
        </div>
      </div>
    </div>
  );
}
