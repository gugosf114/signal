import React, { useEffect, useRef, useState } from 'react';

function DockIcon({ kind }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {kind === 'signal' && <><path d="M4 18V6M4 18h16" /><path d="m7 14 4-5 4 3 5-7" /></>}
    {kind === 'collection' && <><rect x="8" y="5" width="12" height="16" rx="2" /><path d="M15 3H6a2 2 0 0 0-2 2v12M11 9h6M11 13h6" /></>}
    {kind === 'scan' && <><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /><rect x="8" y="7" width="8" height="10" rx="1" /><path d="M6 12h12" /></>}
    {kind === 'dossier' && <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>}
  </svg>;
}

export default function BottomNavigation({ page, tabsRef, onChange, onScan }) {
  const [visible, setVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const scanRef = useRef(null);

  useEffect(() => {
    let frame = null;
    let fullHeight = Math.max(window.innerHeight, window.visualViewport?.height || 0);
    const measure = () => {
      frame = null;
      const viewport = window.visualViewport;
      fullHeight = Math.max(fullHeight, window.innerHeight, viewport?.height || 0);
      const active = document.activeElement;
      const typing = active?.matches?.('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]');
      const keyboardOpen = Boolean(typing && (viewport?.height || window.innerHeight) < fullHeight - 140);
      const blocked = Boolean(document.querySelector('.live-scanner')) || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
        .some((node) => !node.closest('.bottom-dock-shell') && node.getClientRects().length > 0);
      setVisible(Boolean(tabsRef.current && tabsRef.current.getBoundingClientRect().bottom <= 0 && !keyboardOpen && !blocked));
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(measure); };
    const resetHeight = () => { fullHeight = window.innerHeight; schedule(); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', resetHeight);
    window.visualViewport?.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    schedule();
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', resetHeight);
      window.visualViewport?.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, [tabsRef]);

  useEffect(() => { if (!visible) setMenuOpen(false); }, [visible]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    menuRef.current?.querySelector('[data-scan-kind]')?.focus({ preventScroll: true });
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); }
      if (event.key !== 'Tab') return;
      const buttons = [...(menuRef.current?.querySelectorAll('button') || [])];
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('keydown', keydown);
      scanRef.current?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  if (!visible) return null;
  const chooseScan = (kind) => { setMenuOpen(false); onScan(kind); };
  return <div className="bottom-dock-shell" data-page-swipe-ignore="true">
    {menuOpen && <>
      <button type="button" className="bottom-dock-shade" tabIndex={-1} aria-label="Close scan menu" onClick={() => setMenuOpen(false)} />
      <section ref={menuRef} className="bottom-dock-menu" role="dialog" aria-modal="true" aria-labelledby="bottom-scan-title">
        <header><h2 id="bottom-scan-title">Scan cards</h2><button type="button" aria-label="Close scan choices" onClick={() => setMenuOpen(false)}>×</button></header>
        <button type="button" data-scan-kind="single" onClick={() => chooseScan('single')}><DockIcon kind="scan" /><span>Single card</span><b aria-hidden="true">›</b></button>
        <button type="button" data-scan-kind="batch" onClick={() => chooseScan('batch')}><DockIcon kind="collection" /><span>Batch scan</span><b aria-hidden="true">›</b></button>
        <button type="button" data-scan-kind="photos" onClick={() => chooseScan('photos')}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 18 6-6 4 4 3-3 4 4" /></svg><span>Saved photo</span><b aria-hidden="true">›</b></button>
      </section>
    </>}
    <nav className="bottom-dock" aria-label="Quick navigation">
      {[['signal', 'Signal'], ['collection', 'Collection'], ['scan', 'Scan'], ['dossier', 'Dossier']].map(([key, label]) => key === 'scan'
        ? <button key={key} ref={scanRef} type="button" className="bottom-dock-item bottom-dock-scan" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><span className="bottom-dock-icon"><DockIcon kind={key} /></span><span>{label}</span></button>
        : <button key={key} type="button" className={`bottom-dock-item${page === key ? ' bottom-dock-item--active' : ''}`} aria-current={page === key ? 'page' : undefined} aria-controls={`panel-${key}`} onClick={() => { setMenuOpen(false); onChange(key); }}><span className="bottom-dock-icon"><DockIcon kind={key} /></span><span>{label}</span></button>)}
    </nav>
  </div>;
}
