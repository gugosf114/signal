import React from 'react';
import { BrandIcon } from '../config/brandIcons';

const label = {
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: '0.16em',
  fontFamily: "'Syne', sans-serif",
  textTransform: 'uppercase',
  marginBottom: 4,
};

function ScoreTile() {
  return (
    <div style={{
      flex: 1,
      background: '#0E1014',
      border: '1px solid #1A1D24',
      borderRadius: 3,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <BrandIcon brand="pokemon" size={12} style={{ opacity: 0.6 }} />
        <span style={{ fontSize: 9, fontFamily: "'Syne', sans-serif", color: '#A09060', letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase' }}>Pokémon</span>
      </div>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, fontStyle: 'italic', color: '#E8E4DC', lineHeight: 1.1 }}>
        Charizard ex
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 44, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#C44040', lineHeight: 1, letterSpacing: '-0.04em' }}>82</span>
        <span style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", color: '#2A2D34' }}>/100</span>
      </div>
      <div style={{ fontSize: 9, fontFamily: "'Syne', sans-serif", letterSpacing: '0.14em', color: '#C44040', fontWeight: 700, textTransform: 'uppercase' }}>SURGING</div>
    </div>
  );
}

function PriceTile() {
  return (
    <div style={{
      flex: 1,
      background: '#0B0D10',
      border: '1px solid #1A1D24',
      borderRadius: 3,
      overflow: 'hidden',
      minWidth: 0,
    }}>
      {/* EN + JP row */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1A1D24' }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRight: '1px solid #1A1D24' }}>
          <div style={{ ...label, color: '#4A4840' }}>EN Price</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: '#E8E4DC' }}>$42.50</div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', background: 'rgba(196,64,64,0.03)' }}>
          <div style={{ ...label, color: '#8A4040' }}>¥ JP Price</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: '#C44040' }}>¥7,200</div>
        </div>
      </div>
      {/* Arbitrage + Trend row */}
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, padding: '10px 14px', borderRight: '1px solid #1A1D24' }}>
          <div style={{ ...label, color: '#4A4840' }}>Arbitrage</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#6B6860', lineHeight: 1.5 }}>JP leads +$8</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px' }}>
          <div style={{ ...label, color: '#4A4840' }}>30-Day Trend</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: '#608870', fontWeight: 700 }}>▲</div>
        </div>
      </div>
    </div>
  );
}

function SignalTile() {
  return (
    <div style={{
      flex: 1,
      background: '#0E1014',
      border: '1px solid #1A1D24',
      borderRadius: 3,
      padding: '18px 20px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#B08060', letterSpacing: '0.04em', fontWeight: 500, flex: 1 }}>Creator Attention</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#B08060' }} />
          ))}
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A1D24' }} />
        </div>
      </div>
      <div style={{ paddingLeft: 12, borderLeft: '1px solid #1A1D24' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <BrandIcon brand="youtube" size={12} />
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: 13, fontStyle: 'italic', color: '#E8E4DC' }}>
            Leonhart pulls Charizard ex
          </span>
        </div>
        <div style={{ fontSize: 11, fontFamily: "'Syne', sans-serif", color: '#5A5850', lineHeight: 1.5 }}>
          1.6M-sub channel, 284k views in 48h. Strong pull signal.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono'", color: '#608870', fontWeight: 700 }}>▲</span>
          <span style={{ fontSize: 7, fontFamily: "'Syne', sans-serif", letterSpacing: '0.14em', color: '#608870', opacity: 0.7, fontWeight: 700, textTransform: 'uppercase' }}>BULLISH</span>
        </div>
      </div>
    </div>
  );
}

export default function EmptyState() {
  return (
    <div style={{ padding: '40px 0 20px' }}>
      <div className="empty-state-tiles">
        <ScoreTile />
        <PriceTile />
        <SignalTile />
      </div>
      <p style={{
        marginTop: 20,
        textAlign: 'center',
        fontFamily: "'Syne', sans-serif",
        fontSize: 12,
        color: '#3A3830',
        lineHeight: 1.7,
        maxWidth: 520,
        marginLeft: 'auto',
        marginRight: 'auto',
        letterSpacing: '0.01em',
      }}>
        Scan any card across 30+ sources — creator buzz, tournament data, Mercari JP, eBay sold listings — in 30 seconds.
      </p>
    </div>
  );
}
