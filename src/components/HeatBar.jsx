import React from 'react';

const SEGMENT_COUNT = 5;

export default function HeatBar({ level, color }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
        const active = i < level;
        return (
          <div
            key={i}
            style={{
              width: 24,
              height: 6,
              borderRadius: 2,
              background: active ? color : '#1E1E24',
              opacity: active ? 0.7 + (i / SEGMENT_COUNT) * 0.3 : 1,
              transition: 'background 0.3s ease',
            }}
          />
        );
      })}
      <span
        style={{
          marginLeft: 6,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          color: level >= 4 ? color : '#666',
          fontWeight: level >= 4 ? 600 : 400,
        }}
      >
        {level}/5
      </span>
    </div>
  );
}
