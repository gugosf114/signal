import React, { useState, useRef } from 'react';
import { scanCardImage } from '../services/scanCardImage';

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [scanError, setScanError] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !loading) onSearch(query.trim());
  };

  const openCamera = () => {
    setScanError(null);
    fileInputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIdentifying(true);
    setScanError(null);
    try {
      const card = await scanCardImage(file);
      setQuery(card.name);
      onSearch(card.name, card.game || null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[signal] card image scan failed', err);
      setScanError(err?.message || 'Card identification failed.');
    } finally {
      setIdentifying(false);
      if (e.target) e.target.value = '';
    }
  };

  const busy = loading || identifying;

  return (
    <form onSubmit={handleSubmit} style={{
      position: 'relative',
      width: '100%',
      maxWidth: 580,
    }}>
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Hidden file input — capture="environment" hints the rear camera on mobile */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFile}
        />

        {/* Camera button — left side of the input */}
        <button
          type="button"
          onClick={openCamera}
          disabled={busy}
          aria-label="Scan a card with the camera"
          title="Scan a card with the camera"
          style={{
            position: 'absolute',
            left: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 38,
            height: 38,
            background: 'transparent',
            border: 'none',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: identifying ? '#C44040' : '#6B6860',
            cursor: busy ? 'not-allowed' : 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { if (!busy) e.currentTarget.style.color = '#C44040'; }}
          onMouseLeave={(e) => { if (!busy) e.currentTarget.style.color = '#6B6860'; }}
        >
          {identifying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="cam-spin">
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </button>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={identifying ? 'Identifying card…' : 'Card name or set number — e.g. LOB-001'}
          disabled={busy}
          style={{
            width: '100%',
            padding: '16px 78px 16px 50px',
            background: '#0E1014',
            border: `1px solid ${focused ? '#2A2D34' : '#1A1D24'}`,
            borderRadius: 3,
            color: '#E8E4DC',
            fontSize: 15,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 400,
            outline: 'none',
            transition: 'border-color 0.2s',
            letterSpacing: '0.01em',
            boxSizing: 'border-box',
          }}
        />
        <button
          type="submit"
          disabled={!query.trim() || busy}
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            background: !query.trim() || busy ? '#14161A' : '#C44040',
            border: 'none',
            borderRadius: 2,
            color: !query.trim() || busy ? '#2A2820' : '#fff',
            padding: '10px 18px',
            fontSize: 12,
            fontWeight: 700,
            cursor: !query.trim() || busy ? 'not-allowed' : 'pointer',
            fontFamily: "'Syne', sans-serif",
            transition: 'background 0.15s',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {loading ? '···' : 'Scan'}
        </button>
      </div>

      {scanError && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: 'rgba(196, 64, 64, 0.08)',
          border: '1px solid rgba(196, 64, 64, 0.3)',
          borderRadius: 2,
          fontSize: 11,
          color: '#C44040',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.5,
        }}>
          {scanError}
        </div>
      )}
    </form>
  );
}
