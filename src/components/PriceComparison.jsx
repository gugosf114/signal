import React from 'react';
import { reportHistoryMoves } from '../services/reportDisplay';

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
  const moves = reportHistoryMoves(data);
  if (!moves.length) return null;
  const history = data.history;
  return <div className="report-price-history" aria-label="Exact card price history">
    <div className="report-price-moves">
      {moves.map(({ label, value }) => <div className="report-price-move" key={label}>
        <span>{label}</span><strong className={value > 0 ? 'report-price-up' : value < 0 ? 'report-price-down' : ''}>{value > 0 ? '+' : ''}{value}%</strong>
      </div>)}
    </div>
    <Sparkline points={history.points} color="#B6C9B8" />
  </div>;
}
