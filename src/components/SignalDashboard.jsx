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
import CardBrowser from './CardBrowser';
import WatchedCards from './WatchedCards';
import NewsStrip from './NewsStrip';
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
      position: 'relative',
    }}>
      {/* Auth & Scans Status (Top Right) */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 16 : 24,
        right: isMobile ? 16 : 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 10
      }}>
        <span style={{
          fontSize: 11,
          color: '#5A5850',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.04em'
        }}>
          10 scans left
        </span>
        <button 
          title="Sign in with Google"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#E8E4DC',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'transform 0.1s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </button>
      </div>

      {/* Header — stacked center */}
      <div style={{ textAlign: 'center', marginBottom: 24, marginTop: isMobile ? 32 : 0 }}>
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

      {!result && !loading && !error && (
        <>
          <WatchedCards onSelect={handleSearch} />
          <NewsStrip />
          <EmptyState />
          <CardBrowser onCardSelect={handleSearch} />
        </>
      )}
    </div>
  );
}
