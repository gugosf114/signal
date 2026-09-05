import React from 'react';

// Three pages, one strip. Signal is the live analysis side, Collection is the
// shelf, and Dossier explains the human-reviewed research service.

const TABS = [
  { key: 'signal', label: 'Signal' },
  { key: 'collection', label: 'Collection' },
  { key: 'dossier', label: 'Dossier' },
];

export default function PageTabs({ page, onChange }) {
  const onKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.key === page);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? TABS.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % TABS.length
          : (index - 1 + TABS.length) % TABS.length;
    onChange(TABS[next].key);
    requestAnimationFrame(() => document.getElementById(`tab-${TABS[next].key}`)?.focus());
  };
  return (
    <div className="pt-strip" role="tablist" aria-label="Signal pages" onKeyDown={onKeyDown}>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          id={`tab-${t.key}`}
          aria-controls={`panel-${t.key}`}
          aria-selected={page === t.key}
          tabIndex={page === t.key ? 0 : -1}
          className={`pt-tab ${page === t.key ? 'pt-tab--on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
