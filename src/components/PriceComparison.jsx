import React from 'react';

const styles = {
  wrapper: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10,
    marginBottom: 24,
  },
  card: {
    background: '#111115',
    border: '1px solid #1E1E24',
    borderRadius: 10,
    padding: '12px 14px',
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
  },
  subtext: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  jpCard: {
    background: 'rgba(245, 0, 87, 0.05)',
    border: '1px solid rgba(245, 0, 87, 0.15)',
  },
  jpLabel: {
    color: '#F50057',
  },
};

function trendArrow(trend) {
  if (!trend) return { symbol: '—', color: '#555' };
  const t = trend.toLowerCase();
  if (t.includes('up') || t.includes('rising') || t.includes('increas'))
    return { symbol: '▲', color: '#4CAF50' };
  if (t.includes('down') || t.includes('falling') || t.includes('decreas'))
    return { symbol: '▼', color: '#FF5252' };
  return { symbol: '►', color: '#FFD600' };
}

export default function PriceComparison({ data }) {
  if (!data) return null;

  const trend = trendArrow(data.trend_30d);

  return (
    <div className="fade-slide-up" style={styles.wrapper}>
      {/* EN Price */}
      <div style={styles.card}>
        <div style={styles.label}>EN Price</div>
        <div style={{ ...styles.value, color: '#E0E0E0' }}>
          {data.en_price || '—'}
        </div>
        <div style={styles.subtext}>TCGPlayer / eBay</div>
      </div>

      {/* JP Price */}
      <div style={{ ...styles.card, ...styles.jpCard }}>
        <div style={{ ...styles.label, ...styles.jpLabel }}>⛩ JP Price</div>
        <div style={{ ...styles.value, color: '#FF1744' }}>
          {data.jp_price || '—'}
        </div>
        <div style={styles.subtext}>Mercari JP / Rakuten</div>
      </div>

      {/* JP↔EN Gap */}
      <div style={styles.card}>
        <div style={styles.label}>JP↔EN Gap</div>
        <div style={{ ...styles.value, color: '#B0B0B0', fontSize: 14, lineHeight: 1.4 }}>
          {data.jp_en_gap || '—'}
        </div>
      </div>

      {/* 30D Trend */}
      <div style={styles.card}>
        <div style={styles.label}>30D Trend</div>
        <div style={{ ...styles.value, color: trend.color }}>
          {trend.symbol}
        </div>
        <div style={{ ...styles.subtext, color: trend.color }}>
          {data.trend_30d || 'Unknown'}
        </div>
      </div>

      {/* Signal vs Market */}
      <div style={styles.card}>
        <div style={styles.label}>Signal vs Market</div>
        <div style={{
          ...styles.value,
          fontSize: 13,
          color: data.signal_vs_market?.toLowerCase().includes('agree')
            ? '#4CAF50'
            : data.signal_vs_market?.toLowerCase().includes('disagree')
            ? '#FF5252'
            : '#FFD600',
        }}>
          {data.signal_vs_market || '—'}
        </div>
      </div>
    </div>
  );
}
