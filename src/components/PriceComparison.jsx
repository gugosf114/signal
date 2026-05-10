import React from 'react';
import { BrandIcon } from '../config/brandIcons';

// Dense horizontal data feed — think stock ticker, not card grid.

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

const label = {
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: '0.16em',
  fontFamily: "'Syne', sans-serif",
  textTransform: 'uppercase',
  marginBottom: 4,
};

const val = {
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 600,
  lineHeight: 1.2,
};

export default function PriceComparison({ data }) {
  if (!data) return null;

  const trend = trendMeta(data.trend_30d);
  const align = alignMeta(data.signal_vs_market);

  return (
    <div className="fade-slide-up" style={{
      display: 'flex',
      borderTop: '1px solid #1A1D24',
      borderBottom: '1px solid #1A1D24',
      marginBottom: 40,
      background: '#0B0D10',
    }}>
      {/* EN */}
      <div style={{ flex: '1.2', padding: '14px 16px' }}>
        <div style={{ ...label, color: '#4A4840' }}>EN Price</div>
        <div style={{ ...val, fontSize: 16, color: '#E8E4DC' }}>
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

      <div style={{ width: 1, background: '#1A1D24' }} />

      {/* JP */}
      <div style={{ flex: '1.2', padding: '14px 16px', background: 'rgba(196, 64, 64, 0.03)' }}>
        <div style={{ ...label, color: '#8A4040', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, opacity: 0.6 }}>¥</span>
          JP Price
        </div>
        <div style={{ ...val, fontSize: 16, color: '#C44040' }}>
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

      <div style={{ width: 1, background: '#1A1D24' }} />

      {/* Gap */}
      <div style={{ flex: '1.5', padding: '14px 16px' }}>
        <div style={{ ...label, color: '#4A4840' }}>JP↔EN Gap</div>
        <div style={{
          ...val,
          fontSize: 12,
          color: '#6B6860',
          lineHeight: 1.5,
        }}>
          {data.jp_en_gap || '—'}
        </div>
      </div>

      <div style={{ width: 1, background: '#1A1D24' }} />

      {/* 30D */}
      <div style={{ flex: '0.8', padding: '14px 16px' }}>
        <div style={{ ...label, color: '#4A4840' }}>30D</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span
            className={trend.sym === '▲' ? 'trend-bounce-up' : trend.sym === '▼' ? 'trend-bounce-down' : ''}
            style={{ ...val, fontSize: 14, color: trend.color }}
          >
            {trend.sym}
          </span>
        </div>
        <div style={{ fontSize: 9, color: trend.color, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
          {data.trend_30d || '—'}
        </div>
      </div>

      <div style={{ width: 1, background: '#1A1D24' }} />

      {/* Sig vs Mkt */}
      <div style={{ flex: '0.8', padding: '14px 16px' }}>
        <div style={{ ...label, color: '#4A4840' }}>Sig·Mkt</div>
        <span style={{ ...val, fontSize: 14, color: align.color }}>{align.sym}</span>
        <div style={{ fontSize: 9, color: align.color, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", opacity: 0.7 }}>
          {data.signal_vs_market || '—'}
        </div>
      </div>
    </div>
  );
}
