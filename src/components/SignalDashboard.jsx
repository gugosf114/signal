import React, { useState } from 'react';
import SearchBar from './SearchBar';
import QuickPicks from './QuickPicks';
import PriceComparison from './PriceComparison';
import OverallScore from './OverallScore';
import SignalSection from './SignalSection';
import { SIGNAL_SECTIONS, GAME_LABELS, calculateOverallScore } from '../config/signals';
import { analyzeCard } from '../services/analyzeCard';

const styles = {
  container: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '40px 20px 60px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: 700,
    color: '#E0E0E0',
    letterSpacing: '-0.02em',
    marginBottom: 4,
  },
  logoAccent: {
    color: '#F50057',
  },
  tagline: {
    fontSize: 14,
    color: '#555',
    fontFamily: "'JetBrains Mono', monospace",
  },
  searchArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    marginBottom: 36,
  },
  error: {
    background: 'rgba(255, 82, 82, 0.08)',
    border: '1px solid rgba(255, 82, 82, 0.2)',
    borderRadius: 8,
    padding: '12px 16px',
    color: '#FF5252',
    fontSize: 13,
    marginBottom: 20,
  },
  loading: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#444',
  },
  disclaimer: {
    marginTop: 32,
    padding: '12px 16px',
    background: '#0E0E12',
    borderRadius: 8,
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', monospace",
  },
  gameTag: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 16,
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 20px',
    color: '#333',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.3,
  },
  emptyText: {
    fontSize: 14,
    color: '#444',
  },
};

const LOADING_MESSAGES = [
  'Scanning English market sources...',
  'Searching Japanese markets (メルカリ, Rakuten)...',
  'Analyzing tournament results...',
  'Checking creator content...',
  'Evaluating JP↔EN price gap...',
  'Computing signal strength...',
];

export default function SignalDashboard() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');

  const handleSearch = async (query, game = null) => {
    setLoading(true);
    setError(null);
    setResult(null);

    // Cycle loading messages
    let msgIndex = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 3000);

    try {
      const data = await analyzeCard(query, game);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const score = result
    ? calculateOverallScore(result.signals || [], result.game)
    : null;

  const gameMeta = result ? GAME_LABELS[result.game] : null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoAccent}>Signal</span>
        </div>
        <div style={styles.tagline}>trading card intelligence</div>
      </div>

      {/* Search */}
      <div style={styles.searchArea}>
        <SearchBar onSearch={handleSearch} loading={loading} />
        <QuickPicks onSelect={handleSearch} loading={loading} />
      </div>

      {/* Error */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Loading */}
      {loading && (
        <div style={styles.loading}>
          <div className="loading-pulse" style={styles.loadingText}>
            {loadingMsg}
          </div>
          <div style={styles.loadingSubtext}>
            This takes 15–30 seconds — searching live sources
          </div>
          <div
            style={{
              margin: '16px auto 0',
              width: 200,
              height: 3,
              borderRadius: 2,
            }}
            className="loading-shimmer"
          />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Game tag */}
          {gameMeta && (
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span
                style={{
                  ...styles.gameTag,
                  color: gameMeta.color,
                  background: gameMeta.color + '15',
                }}
              >
                {gameMeta.label}
              </span>
            </div>
          )}

          {/* Overall Score */}
          {score !== null && (
            <OverallScore
              score={score}
              cardName={result.card_name}
              game={result.game}
              summary={result.summary}
            />
          )}

          {/* Price Comparison */}
          <PriceComparison data={result.prices} />

          {/* Signal Sections */}
          {SIGNAL_SECTIONS.map((section, sIdx) => (
            <SignalSection
              key={section.id}
              section={section}
              signals={result.signals || []}
              baseDelay={sIdx * 3}
            />
          ))}

          {/* Disclaimer */}
          <div className="fade-slide-up fade-slide-up-9" style={styles.disclaimer}>
            Signal data is for informational purposes only. Not financial advice.
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⚡</div>
          <div style={styles.emptyText}>
            Search a card or pick one above to scan for signals
          </div>
        </div>
      )}
    </div>
  );
}
