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

const BACKDROPS = {
  creator: (c) => (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M36 72h24l10-28 16 55 15-42 13 24h31" stroke={c} strokeWidth="2" opacity=".34" />
      <circle cx="247" cy="60" r="28" stroke={c} strokeWidth="2" opacity=".5" />
      <path d="M240 45v30l24-15z" fill={c} opacity=".42" />
      <path d="M207 31q-24 29 0 58M287 31q24 29 0 58" stroke={c} strokeWidth="1.5" opacity=".28" />
    </svg>
  ),
  community: (c) => (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M54 83 104 38l57 39 57-48 54 49M104 38l114-9M161 77l111 1M54 83l107-6" stroke={c} strokeWidth="1.5" opacity=".35" />
      {[['54','83','8'],['104','38','10'],['161','77','12'],['218','29','9'],['272','78','11']].map(([cx,cy,r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={c} opacity=".28" stroke={c} strokeWidth="2" />
      ))}
    </svg>
  ),
  ip_momentum: (c) => (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M32 101h258M48 88V67m0 7h-8m8 0h10M93 78V42m0 9H82m11 0h11M143 70V50m0 8h-9m9 0h10M199 51V23m0 8h-10m10 0h10" stroke={c} strokeWidth="1.5" opacity=".28" />
      <path d="m34 94 57-23 46 5 55-31 68-15" stroke={c} strokeWidth="3" opacity=".62" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m246 21 16 8-10 15" stroke={c} strokeWidth="3" opacity=".62" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  editorial: (c) => (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <rect x="58" y="19" width="204" height="82" rx="3" stroke={c} strokeWidth="2" opacity=".45" />
      <rect x="75" y="35" width="66" height="47" fill={c} opacity=".16" />
      <path d="M158 36h83M158 48h70M158 60h78M75 91h166" stroke={c} strokeWidth="2" opacity=".34" />
      <path d="M48 29v82h204" stroke={c} strokeWidth="1" opacity=".18" />
    </svg>
  ),
  competitive: (c) => (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M38 24h42v24h36M38 96h42V72h36M282 24h-42v24h-36M282 96h-42V72h-36" stroke={c} strokeWidth="2" opacity=".34" />
      <path d="M132 42h56v31q0 24-28 30-28-6-28-30z" stroke={c} strokeWidth="2.5" opacity=".48" />
      <path d="M144 42q-3-16 16-20 19 4 16 20M145 58h30M160 58v27" stroke={c} strokeWidth="2" opacity=".34" />
    </svg>
  ),
  scarcity: (c) => (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="m159 14 57 38-57 56-57-56z" stroke={c} strokeWidth="2.5" opacity=".52" />
      <path d="m102 52 57 14 57-14M159 14v94M102 52l57-38 57 38-57 14z" stroke={c} strokeWidth="1.5" opacity=".25" />
      <path d="M44 94h25V69H44zm207 0h25V38h-25z" fill={c} opacity=".16" />
    </svg>
  ),
  jp_hype: (c) => (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" fill="none">
      {[0,1,2,3].flatMap((row) => [0,1,2,3,4,5].map((col) => (
        <rect key={`${row}-${col}`} x={42 + col * 28} y={20 + row * 22} width="20" height="14" rx="2"
          fill={c} opacity={0.08 + ((row + col) % 4) * 0.07} />
      )))}
      <path d="M225 88c34-12 34-44 0-56M225 75c18-8 18-26 0-34" stroke={c} strokeWidth="2" opacity=".38" />
      <circle cx="225" cy="59" r="6" fill={c} opacity=".5" />
    </svg>
  ),
  jp_release: (c) => (
    <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M38 67h244" stroke={c} strokeWidth="2" opacity=".38" />
      {[64,112,160,208,256].map((x, index) => (
        <g key={x}>
          <circle cx={x} cy="67" r={index === 2 ? 9 : 6} fill={c} opacity={index === 2 ? '.48' : '.24'} />
          <path d={`M${x} 36v18M${x} 80v17`} stroke={c} opacity=".24" />
        </g>
      ))}
      <path d="m265 56 17 11-17 11" stroke={c} strokeWidth="2" opacity=".5" />
      <path d="M105 25h110M122 25v22m76-22v22M112 15h96" stroke={c} strokeWidth="2" opacity=".28" />
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
  const backdropFn = BACKDROPS[signal.key];

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
      className={`fade-slide-up fade-slide-up-${animDelay} signal-card-row ${expanded ? 'signal-card-row--expanded' : ''}`}
      style={{
        padding: 0,
        marginBottom: 8,
        borderBottom: `1px solid ${isJapan ? 'rgba(196,64,64,0.28)' : 'rgba(232,228,220,0.2)'}`,
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
          minHeight: 102,
          padding: '20px 12px 22px',
          boxSizing: 'border-box',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
      {backdropFn && (
        <div className="signal-card-backdrop" aria-hidden="true">
          {backdropFn(meta.color)}
        </div>
      )}
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
