import React from 'react';

function getStyle(level, color) {
  if (level >= 4) return { color, fontWeight: 700 };
  if (level >= 3) return { color: '#6B6860', fontWeight: 600 };
  if (level >= 2) return { color: '#3A3830', fontWeight: 500 };
  return { color: '#2A2820', fontWeight: 400 };
}

export default function HeatBar({ level, color }) {
  const s = getStyle(level, color);

  return (
    <span style={{
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: '-0.02em',
      ...s,
    }}>
      {level}<span style={{ opacity: 0.3, fontWeight: 400 }}>/5</span>
    </span>
  );
}
