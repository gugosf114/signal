import React, { useState, useRef, useEffect } from 'react';
import HeatBar from './HeatBar';
import SourceCitation from './SourceCitation';
import { SIGNAL_TYPES } from '../config/signals';
import { extractYouTubeId, BrandIcon, brandFromUrl } from '../config/brandIcons';

const MARKS = {
  creator: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polygon points="6.5,3 6.5,13 13,8" fill={c} opacity="0.5" />
    </svg>
  ),
  community: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="6" r="2" stroke={c} strokeWidth="1.2" opacity="0.45" />
      <circle cx="10.5" cy="6" r="2" stroke={c} strokeWidth="1.2" opacity="0.45" />
      <circle cx="8" cy="11" r="2" stroke={c} strokeWidth="1.2" opacity="0.45" />
    </svg>
  ),
  ip_momentum: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 12 L6 7 L9 9 L14 3" stroke={c} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  editorial: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="3" y1="4" x2="13" y2="4" stroke={c} strokeWidth="1.2" opacity="0.4" />
      <line x1="3" y1="7.5" x2="13" y2="7.5" stroke={c} strokeWidth="1.2" opacity="0.3" />
      <line x1="3" y1="11" x2="9" y2="11" stroke={c} strokeWidth="1.2" opacity="0.2" />
    </svg>
  ),
  competitive: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2 L10 6.5 L14.5 6.5 L11 9.5 L12 14 L8 11 L4 14 L5 9.5 L1.5 6.5 L6 6.5 Z"
        stroke={c} strokeWidth="1" fill="none" opacity="0.4" />
    </svg>
  ),
  scarcity: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2 L11 7 L8 14 L5 7 Z" stroke={c} strokeWidth="1" fill="none" opacity="0.4" />
    </svg>
  ),
  jp_hype: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <text x="8" y="12" textAnchor="middle" fontSize="10" fill={c} opacity="0.6"
        fontWeight="700" fontFamily="'Noto Sans JP'">熱</text>
    </svg>
  ),
  jp_release: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <text x="8" y="12" textAnchor="middle" fontSize="10" fill={c} opacity="0.6"
        fontWeight="700" fontFamily="'Noto Sans JP'">先</text>
    </svg>
  ),
};

export default function SignalCard({ signal, animDelay = 0, isJapan = false }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const sourceRefs = useRef([]);
  const meta = SIGNAL_TYPES[signal.key];
  if (!meta) return null;

  const isHot = signal.level >= 4;
  const markFn = MARKS[signal.key];

  const preview = signal.detail
    ? signal.detail.substring(0, 72) + (signal.detail.length > 72 ? '…' : '')
    : meta.description;

  const toggle = () => setExpanded(e => !e);

  useEffect(() => {
    if (!expanded) setActiveSourceIdx(0);
  }, [expanded]);

  const sources = Array.isArray(signal.sources) ? signal.sources : [];
  // Citations the filter binned because their URL couldn't be traced back to a
  // real retrieval. Set by filterHallucinatedSources; absent on legacy cached scans.
  const dropped = typeof signal.dropped === 'number' ? signal.dropped : 0;
  const ytSources = sources.filter(s => extractYouTubeId(s.url));
  const otherSources = sources.filter(s => !extractYouTubeId(s.url));

  const navigateToSource = (idx) => {
    setActiveSourceIdx(idx);
    const el = sourceRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div
      id={`signal-${signal.key}`}
      className={`fade-slide-up fade-slide-up-${animDelay} signal-card-row`}
      style={{
        padding: '14px 0',
        borderBottom: `1px solid ${isJapan ? 'rgba(196,64,64,0.06)' : '#14161A'}`,
        transition: 'background 0.12s',
        '--signal-color': meta.color,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.012)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <button
        type="button"
        className="signal-card-toggle"
        aria-expanded={expanded}
        aria-controls={`signal-evidence-${signal.key}`}
        onClick={toggle}
        style={{
          display: 'block',
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
      {/* Row: mark + label + heatbar + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center' }}>
          {markFn ? markFn(meta.color) : null}
        </div>

        <span
          className="signal-card-label"
          style={{
            fontFamily: isJapan ? "'Instrument Serif', serif" : "'Syne', sans-serif",
            fontSize: isJapan ? 14 : 12,
            fontWeight: isJapan ? 400 : (isHot ? 700 : 500),
            fontStyle: isJapan ? 'italic' : 'normal',
            letterSpacing: isJapan ? '0.01em' : '0.04em',
            color: isHot ? meta.color : '#A8A498',
            flex: 1,
            minWidth: 0,
          }}
        >
          {meta.label}
        </span>

        <HeatBar level={signal.level} color={meta.color} />

        {/* Source preview: dominant brand logos + count, surfaces what's behind
            the score before the row is even expanded. */}
        {!expanded && sources.length > 0 && (() => {
          const brands = [];
          const seen = new Set();
          for (const s of sources) {
            const b = brandFromUrl(s.url) || (s.type === 'youtube' ? 'youtube' : null);
            if (b && !seen.has(b)) { seen.add(b); brands.push(b); }
            if (brands.length === 3) break;
          }
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {brands.map((b) => (
                <BrandIcon key={b} brand={b} size={11} style={{ opacity: 0.65 }} />
              ))}
              <span style={{
                fontSize: 8,
                fontFamily: "'JetBrains Mono', monospace",
                color: meta.color,
                opacity: 0.55,
                letterSpacing: '0.04em',
                marginLeft: brands.length ? 2 : 0,
              }}>
                {sources.length}
              </span>
            </span>
          );
        })()}

        <span style={{
          fontSize: 14,
          color: '#92897C',
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s',
          fontFamily: "'JetBrains Mono'",
          flexShrink: 0,
        }}>&#9658;</span>
      </div>

      {/* Preview */}
      {!expanded && (
        <div style={{
          fontSize: 14,
          color: '#92897C',
          marginTop: 4,
          marginLeft: 26,
          lineHeight: 1.5,
          fontFamily: "'Syne', sans-serif",
          fontWeight: 400,
        }}>
          {preview}
        </div>
      )}
      </button>

      {/* Expanded evidence */}
      <div id={`signal-evidence-${signal.key}`} className={`signal-evidence ${expanded ? 'expanded' : ''}`}>
        <div>
          {expanded && (
            <div style={{
              marginTop: 10,
              marginLeft: 26,
              paddingLeft: 14,
              borderLeft: `1px solid ${isJapan ? 'rgba(196,64,64,0.12)' : '#1A1D24'}`,
            }}>
              <div style={{
                fontSize: 14,
                color: '#92897C',
                lineHeight: 1.7,
                fontFamily: "'Syne', sans-serif",
                fontWeight: 400,
                marginBottom: sources.length ? 14 : 0,
              }}>
                {signal.detail || meta.description}
              </div>

              {sources.length > 0 && (
                <div style={{
                  marginTop: 6,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(26, 29, 36, 0.6)',
                }}>
                  {/* Source navigation dots — one per source, click to jump */}
                  {sources.length > 1 && <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}>
                    <span style={{
                      fontSize: 8,
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: '#605C54',
                    }}>
                      Sources
                    </span>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      {sources.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); navigateToSource(idx); }}
                          title={`Source ${idx + 1} of ${sources.length}`}
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: idx === activeSourceIdx ? meta.color : 'transparent',
                            border: `1.5px solid ${idx === activeSourceIdx ? meta.color : '#605C54'}`,
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0,
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                        />
                      ))}
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#605C54',
                    }}>
                      {activeSourceIdx + 1}/{sources.length}
                    </span>
                  </div>}

                  {/* YouTube citations — 2-up grid on desktop when ≥2 */}
                  {ytSources.length >= 2 ? (
                    <div className="yt-sources-grid">
                      {ytSources.map((src, idx) => {
                        const globalIdx = idx;
                        return (
                          <div
                            key={idx}
                            ref={el => { sourceRefs.current[globalIdx] = el; }}
                            style={{
                              borderLeft: `2px solid ${globalIdx === activeSourceIdx ? meta.color : 'transparent'}`,
                              paddingLeft: globalIdx === activeSourceIdx ? 6 : 0,
                              transition: 'border-color 0.2s, padding-left 0.2s',
                            }}
                          >
                            <SourceCitation source={src} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    ytSources.map((src, idx) => (
                      <div
                        key={idx}
                        ref={el => { sourceRefs.current[idx] = el; }}
                        style={{
                          borderLeft: `2px solid ${idx === activeSourceIdx ? meta.color : 'transparent'}`,
                          paddingLeft: idx === activeSourceIdx ? 6 : 0,
                          transition: 'border-color 0.2s, padding-left 0.2s',
                        }}
                      >
                        <SourceCitation source={src} />
                      </div>
                    ))
                  )}

                  {/* Non-YouTube citations */}
                  {otherSources.map((src, idx) => {
                    const globalIdx = ytSources.length + idx;
                    return (
                      <div
                        key={'o' + idx}
                        ref={el => { sourceRefs.current[globalIdx] = el; }}
                        style={{
                          borderLeft: `2px solid ${globalIdx === activeSourceIdx ? meta.color : 'transparent'}`,
                          paddingLeft: globalIdx === activeSourceIdx ? 6 : 0,
                          transition: 'border-color 0.2s, padding-left 0.2s',
                        }}
                      >
                        <SourceCitation source={src} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Two very different kinds of empty. "Nothing was found" is a
                  market fact; "we caught fabricated citations and binned them"
                  is the filter earning its keep. Never render them the same. */}
              {sources.length === 0 && (
                <div style={{
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(26, 29, 36, 0.4)',
                  fontSize: 13,
                  color: dropped > 0 ? '#A09060' : '#494640',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.06em',
                }}>
                  {dropped > 0
                    ? `// ${dropped} source${dropped === 1 ? '' : 's'} rejected — link could not be verified`
                    : '// no sources found for this signal'}
                </div>
              )}

              {/* Some survived, some didn't — still worth saying so. */}
              {sources.length > 0 && dropped > 0 && (
                <div style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: '#A09060',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.06em',
                }}>
                  // {dropped} more rejected — link could not be verified
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
