import React from 'react';

const STATUS = { ok: 'Checked', empty: 'No matches', unavailable: 'Could not check', partial: 'Partly checked', not_checked: 'Not checked', saved: 'Saved value' };
export function checkedDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'date unknown';
}
export default function ResearchChecks({ checks = [] }) {
  if (!checks.length) return null;
  return <details style={{ marginTop: 12 }}>
    <summary>Research checks</summary>
    <ul style={{ paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
      {checks.map(check => <li key={check.key}>{check.label} — {STATUS[check.status] || 'Not checked'}{check.checkedAt ? ` · ${checkedDate(check.checkedAt)}` : ''}</li>)}
    </ul>
  </details>;
}
