import React from 'react';

export default function SourceCount({ sources }) {
  const count = Array.isArray(sources) ? sources.length : 0;
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--signal-text-secondary)',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {count} {count === 1 ? 'source' : 'sources'}
    </span>
  );
}
