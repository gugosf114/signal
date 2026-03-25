import React, { useState } from 'react';

const styles = {
  wrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: 560,
  },
  input: {
    width: '100%',
    padding: '14px 48px 14px 20px',
    background: '#141418',
    border: '1px solid #2A2A30',
    borderRadius: 10,
    color: '#E0E0E0',
    fontSize: 16,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  inputFocused: {
    borderColor: '#4A4A55',
  },
  button: {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    background: '#F50057',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    padding: '8px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'background 0.2s',
  },
  buttonDisabled: {
    background: '#333',
    cursor: 'not-allowed',
  },
};

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !loading) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.wrapper}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search card name or set number (e.g. LOB-001)..."
        style={{ ...styles.input, ...(focused ? styles.inputFocused : {}) }}
      />
      <button
        type="submit"
        disabled={!query.trim() || loading}
        style={{
          ...styles.button,
          ...(!query.trim() || loading ? styles.buttonDisabled : {}),
        }}
      >
        {loading ? '...' : 'Scan'}
      </button>
    </form>
  );
}
