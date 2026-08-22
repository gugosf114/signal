import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[signal] render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ maxWidth: 520, margin: '80px auto', padding: 24, color: '#E8E4DC', fontFamily: "'Syne', sans-serif" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Signal hit a screen error.</h1>
        <p style={{ color: '#92897C', lineHeight: 1.6, marginBottom: 20 }}>
          Reload the app. Your scans and collection stay on this phone.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ minHeight: 44, padding: '0 18px', background: '#0E1014', color: '#E8E4DC', border: '1px solid #C44040', borderRadius: 4 }}
        >
          Reload Signal
        </button>
      </main>
    );
  }
}
