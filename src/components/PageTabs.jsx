import React from 'react';

// Two pages, one strip. Signal is the analysis side; Collection is the shelf.
// They share nothing but the header, on purpose — the whole point of the
// Collection page is that it never shows a price.

const TABS = [
  { key: 'signal', label: 'Signal' },
  { key: 'collection', label: 'Collection' },
];

export default function PageTabs({ page, onChange }) {
  return (
    <div className="pt-strip" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={page === t.key}
          className={`pt-tab ${page === t.key ? 'pt-tab--on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
