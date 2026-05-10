import React, { useState } from 'react';
import SearchBar from './SearchBar';
import QuickPicks from './QuickPicks';
import RecentScans from './RecentScans';
import PriceComparison from './PriceComparison';
import OverallScore from './OverallScore';
import SignalSection from './SignalSection';
import SignalNav from './SignalNav';
import LoadingTheater from './LoadingTheater';
import EmptyState from './EmptyState';
import { SIGNAL_SECTIONS, calculateOverallScore } from '../config/signals';
import { analyzeCard } from '../services/analyzeCard';
import { useIsMobile } from '../hooks/useIsMobile';

export default function SignalDashboard() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingCard, setPendingCard] = useState(null);
  const [lastSearched, setLastSearched] = useState(null);
  const isMobile = useIsMobile();

  const handleSearch = async (query, game = null) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPendingCard({ name: query, game });
    setLastSearched({ name: query, game });

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
      padding: isMobile ? '24px 16px 60px' : '32px 24px 60px',
    }}>
      {/* Header — stacked center */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
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
        marginBottom: 40,
      }}>
        <SearchBar onSearch={handleSearch} loading={loading} />
        <QuickPicks onSelect={handleSearch} loading={loading} />
        <RecentScans onSelect={handleSearch} loading={loading} />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          borderLeft: '3px solid #C44040',
          background: 'rgba(196, 64, 64, 0.04)',
          padding: '16px 20px',
          marginBottom: 24,
          borderRadius: '0 2px 2px 0',
        }}>
          <div style={{
            fontSize: 11,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#C44040',
            textTransform: 'uppercase',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            Scan failed
            {lastSearched?.name && (
              <span style={{ fontWeight: 400, color: '#5A5850', textTransform: 'none', letterSpacing: 0 }}>
                — {lastSearched.name}
              </span>
            )}
          </div>
          <div style={{
            fontSize: 12,
            color: '#5A5850',
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 12,
            lineHeight: 1.55,
          }}>
            {error}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => lastSearched && handleSearch(lastSearched.name, lastSearched.game)}
              style={{
                background: 'none',
                border: '1px solid rgba(196, 64, 64, 0.4)',
                borderRadius: 2,
                padding: '4px 14px',
                color: '#C44040',
                fontSize: 11,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              Retry scan
            </button>
            <span style={{
              fontSize: 10,
              color: '#3A3830',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.04em',
            }}>
              Check spelling · TCG card names are exact
            </span>
          </div>
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
              signalCount={(result.signals || []).length}
              onRetry={() => handleSearch(result.card_name, result.game)}
              signals={result.signals || []}
              enPrice={result.prices?.en_price}
              jpPrice={result.prices?.jp_price}
              trend={result.prices?.trend_30d}
            />
          )}

          <PriceComparison
            data={{
              ...result.prices,
              trend_30d: result.prices?.trend_30d,
              signal_vs_market: result.prices?.signal_vs_market,
            }}
          />

          {/* Signal navigation — jump to any section */}
          <SignalNav signals={result.signals || []} />

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
            fontSize: 10,
            color: '#3A3830',
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.06em',
          }}>
            Signal data is for informational purposes only. Not financial advice.
          </div>
        </>
      )}

      {!result && !loading && !error && <EmptyState />}
    </div>
  );
}
