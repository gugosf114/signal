import React from 'react';

export default function GradingROI({ data }) {
  if (!data || data.confidence === 'insufficient_data') return null;

  const { raw_price_usd, psa10_est_usd, grading_cost_usd, net_roi_usd, net_roi_pct, verdict, confidence, note } = data;

  const verdictStyle = {
    worth_grading:     { color: '#4CAF70', label: 'WORTH GRADING' },
    marginal:          { color: '#A09060', label: 'MARGINAL' },
    not_worth_grading: { color: '#B04848', label: 'SKIP GRADING' },
  }[verdict] || { color: '#7A7368', label: '—' };

  const roiPositive = net_roi_usd > 0;

  return (
    <div style={{
      background: '#141414',
      border: '1px solid #2a2a2a',
      borderRadius: 6,
      padding: '18px 20px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#888', textTransform: 'uppercase' }}>
          Grading ROI
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: verdictStyle.color }}>
          {verdictStyle.label}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: note ? 10 : 0 }}>
        <Cell label="Raw" value={raw_price_usd != null ? `$${raw_price_usd}` : '—'} />
        <Arrow />
        <Cell label="PSA 10 est." value={psa10_est_usd != null ? `$${psa10_est_usd}` : '—'} />
        <Minus />
        <Cell label="Grading" value={grading_cost_usd != null ? `$${grading_cost_usd}` : '~$25'} dim />
        <Equals />
        <Cell
          label="Net"
          value={net_roi_usd != null ? `${roiPositive ? '+' : ''}$${net_roi_usd}` : '—'}
          sub={net_roi_pct != null ? `${roiPositive ? '+' : ''}${net_roi_pct}%` : null}
          highlight={roiPositive ? '#4CAF70' : '#B04848'}
        />
      </div>

      {note && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 8, lineHeight: 1.4 }}>{note}</div>
      )}

      {confidence === 'low' && (
        <div style={{ fontSize: 10, color: '#555', marginTop: 6 }}>
          Low confidence — PSA 10 estimate based on model knowledge; verify on eBay sold.
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, sub, highlight, dim }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 52 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: highlight || (dim ? '#555' : '#ddd'), fontFamily: 'monospace' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: highlight || '#888', fontFamily: 'monospace' }}>{sub}</div>}
      <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function Arrow() {
  return <div style={{ color: '#444', fontSize: 16, paddingBottom: 10 }}>→</div>;
}

function Minus() {
  return <div style={{ color: '#444', fontSize: 16, paddingBottom: 10 }}>−</div>;
}

function Equals() {
  return <div style={{ color: '#444', fontSize: 16, paddingBottom: 10 }}>=</div>;
}
