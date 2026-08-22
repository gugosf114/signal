import React from 'react';

// Flat rectangular segments — reads immediately as a rating bar, not pagination dots.
//
// Sizing note: these were 7×3px, which on a phone is below the threshold where
// a filled segment reads as different from an empty one — the strength of a
// signal was effectively invisible on the device the app is actually used on.
// Doubled in height and widened, with a dim rail behind the empty segments so
// the bar still reads as a five-step scale rather than a few floating ticks.
export default function HeatBar({ level, color }) {
  return (
    <div
      title={`Signal strength: ${level}/5`}
      role="meter"
      aria-label="Signal strength"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={Math.max(0, Math.min(5, Number(level) || 0))}
      style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const on = i < level;
        return (
          <div
            key={i}
            style={{
              width: 9,
              height: 6,
              borderRadius: 1,
              background: on ? color : '#181B21',
              boxShadow: on ? `0 0 4px ${color}55` : 'inset 0 0 0 1px #22262E',
            }}
          />
        );
      })}
    </div>
  );
}
