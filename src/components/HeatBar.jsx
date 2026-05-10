import React from 'react';

// Flat rectangular segments — reads immediately as a rating bar, not pagination dots.
export default function HeatBar({ level, color }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          title={`Signal strength: ${level}/5`}
          style={{
            width: 7,
            height: 3,
            borderRadius: 1,
            background: i < level ? color : '#1A1D24',
          }}
        />
      ))}
    </div>
  );
}
