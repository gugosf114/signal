import React, { useState } from 'react';

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !loading) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} style={{
      position: 'relative',
      width: '100%',
      maxWidth: 580,
    }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Card name or set number — e.g. LOB-001"
        style={{
          width: '100%',
          padding: '16px 60px 16px 20px',
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
        }}
      />
      <button
        type="submit"
        disabled={!query.trim() || loading}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          background: !query.trim() || loading ? '#14161A' : '#C44040',
          border: 'none',
          borderRadius: 2,
          color: !query.trim() || loading ? '#2A2820' : '#fff',
          padding: '10px 18px',
          fontSize: 12,
          fontWeight: 700,
          cursor: !query.trim() || loading ? 'not-allowed' : 'pointer',
          fontFamily: "'Syne', sans-serif",
          transition: 'background 0.15s',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {loading ? '···' : 'Scan'}
      </button>
    </form>
  );
}
