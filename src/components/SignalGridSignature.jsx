import React from 'react';

const RAIN_COLUMNS = [
  { x: 12, count: 4, delay: 0.02 },
  { x: 30, count: 6, delay: 0.18 },
  { x: 49, count: 3, delay: 0.08 },
  { x: 70, count: 5, delay: 0.26 },
  { x: 92, count: 7, delay: 0.12 },
  { x: 116, count: 4, delay: 0.32 },
  { x: 139, count: 6, delay: 0.05 },
  { x: 163, count: 3, delay: 0.23 },
  { x: 185, count: 7, delay: 0.14 },
  { x: 209, count: 5, delay: 0.36 },
  { x: 232, count: 4, delay: 0.1 },
  { x: 255, count: 6, delay: 0.29 },
  { x: 278, count: 3, delay: 0.17 },
  { x: 301, count: 5, delay: 0.4 },
  { x: 324, count: 4, delay: 0.2 },
  { x: 346, count: 6, delay: 0.31 },
];

export default function SignalGridSignature({ active = false }) {
  return (
    <div
      className={`news-grid-signature news-grid-signature--${active ? 'active' : 'idle'}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 360 72" focusable="false">
        <defs>
          <pattern id="signal-grid-cell-pattern" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect x="1.4" y="1.4" width="4.4" height="4.4" rx="0.55" fill="#C44040" />
          </pattern>
          <mask id="signal-grid-word-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="72">
            <rect width="360" height="72" fill="#000" />
            <text x="10" y="57" fill="#FFF" fontFamily="'Noto Sans JP', sans-serif" fontSize="52" fontWeight="900">株</text>
            <text x="76" y="53" fill="#FFF" fontFamily="'Syne', sans-serif" fontSize="40" fontWeight="800" letterSpacing="4">SIGNAL</text>
          </mask>
        </defs>

        <g className="news-grid-rain">
          {RAIN_COLUMNS.flatMap((column, columnIndex) => (
            Array.from({ length: column.count }, (_, rowIndex) => {
              const accent = (columnIndex + rowIndex) % 8 === 0;
              return (
                <rect
                  key={`${column.x}-${rowIndex}`}
                  className={`news-grid-rain-cell${accent ? ' news-grid-rain-cell--accent' : ''}`}
                  x={column.x}
                  y={4 + rowIndex * 9}
                  width="4.6"
                  height="4.6"
                  rx="0.6"
                  style={{
                    '--grid-rain-delay': `${column.delay + rowIndex * 0.035}s`,
                    '--grid-rain-travel': `${30 + ((columnIndex + rowIndex) % 4) * 8}px`,
                  }}
                />
              );
            })
          ))}
        </g>

        <g className="news-grid-word" mask="url(#signal-grid-word-mask)">
          <rect width="360" height="72" fill="url(#signal-grid-cell-pattern)" />
        </g>
      </svg>
    </div>
  );
}
