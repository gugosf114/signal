import React, { useEffect, useRef, useState } from 'react';

export default function ReportTools({ onSave, onShare, onRescan, busy }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    root.current?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus({ preventScroll: true }); }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = [...(root.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
      const at = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', keydown); };
  }, [open]);
  const run = (action) => { setOpen(false); trigger.current?.focus({ preventScroll: true }); action(); };
  return <div ref={root} className="report-tools">
    <button ref={trigger} type="button" className="report-tools-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} disabled={busy}>
      {busy ? 'Preparing PDF…' : 'Tools'}<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
    </button>
    {open && <div className="report-tools-menu" role="menu" aria-label="Report tools">
      <button type="button" role="menuitem" onClick={() => run(onSave)}>Save PDF</button>
      <button type="button" role="menuitem" onClick={() => run(onShare)}>Share</button>
      <button type="button" role="menuitem" onClick={() => run(onRescan)}>Re-scan</button>
    </div>}
  </div>;
}
