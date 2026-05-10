import React, { useState } from 'react';
import SearchBar from './SearchBar';
import QuickPicks from './QuickPicks';
import PriceComparison from './PriceComparison';
import OverallScore from './OverallScore';
import SignalSection from './SignalSection';
import LoadingTheater from './LoadingTheater';
import { SIGNAL_SECTIONS, calculateOverallScore } from '../config/signals';
import { analyzeCard } from '../services/analyzeCard';

export default function SignalDashboard() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingCard, setPendingCard] = useState(null);

  const handleSearch = async (query, game = null) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPendingCard({ name: query, game });

    // 90-second client-side failsafe so a hung fetch doesn't loop the
    // theater forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const data = await analyzeCard(query, game, { signal: controller.signal });
      setResult(data);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Scan exceeded 90 seconds. Network or model congestion — retry.');
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setPendingCard(null);
    }
  };

  const score = result
    ? calculateOverallScore(result.signals || [], result.game)
    : null;

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: '48px 24px 80px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 22px 9px 16px',
          borderRadius: 3,
          background: '#C44040',
          marginBottom: 6,
        }}>
          <span style={{
            fontSize: 26,
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}>株</span>
          <span style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#fff',
            fontFamily: "'Syne', sans-serif",
            letterSpacing: '-0.02em',
          }}>Signal</span>
        </div>
        <div style={{
          fontSize: 11,
          color: '#3A3830',
          fontFamily: "'Syne', sans-serif",
          fontWeight: 500,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          trading card intelligence
        </div>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        marginBottom: 48,
      }}>
        <SearchBar onSearch={handleSearch} loading={loading} />
        <QuickPicks onSelect={handleSearch} loading={loading} />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          borderLeft: '2px solid #C44040',
          padding: '10px 16px',
          color: '#C44040',
          fontSize: 12,
          marginBottom: 24,
          fontFamily: "'JetBrains Mono', monospace",
          background: 'rgba(196, 64, 64, 0.04)',
        }}>
          {error}
        </div>
      )}

      {/* Loading Theater */}
      {loading && (
        <div style={{
          margin: '0 calc(-50vw + 50%)',
          padding: '0 16px',
          maxWidth: '100vw',
        }}>
          <LoadingTheater
            cardName={pendingCard?.name}
            game={pendingCard?.game}
          />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {score !== null && (
            <OverallScore
              score={score}
              cardName={result.card_name}
              game={result.game}
              summary={result.summary}
              truncated={result._truncated}
            />
          )}

          <PriceComparison data={result.prices} />

          {SIGNAL_SECTIONS.map((section, sIdx) => (
            <SignalSection
              key={section.id}
              section={section}
              signals={result.signals || []}
              baseDelay={sIdx * 3}
            />
          ))}

          <div className="fade-slide-up fade-slide-up-9" style={{
            marginTop: 40,
            paddingTop: 16,
            borderTop: '1px solid #14161A',
            fontSize: 9,
            color: '#2A2820',
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.06em',
          }}>
            Signal data is for informational purposes only. Not financial advice.
          </div>
        </>
      )}

      {/* Empty */}
      {!result && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 16,
            fontStyle: 'italic',
            color: '#2A2820',
          }}>
            Search a card to scan for signals
          </div>
        </div>
      )}
    </div>
  );
}
