import React from 'react';

export default function HeatBar({ level, color }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i < level ? color : '#1A1D24',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}
