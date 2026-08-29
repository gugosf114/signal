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
    <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <g stroke={c} opacity=".34">
        <circle cx="264" cy="55" r="18" /><circle cx="264" cy="55" r="34" /><circle cx="264" cy="55" r="50" />
        <path d="M264 3v104M212 55h104M228 19l72 72M300 19l-72 72" opacity=".55" />
      </g>
      <g fill={c} opacity=".28">
        <circle cx="290" cy="35" r="2"/><circle cx="307" cy="43" r="1.5"/><circle cx="316" cy="59" r="2"/>
        <circle cx="296" cy="72" r="1.5"/><circle cx="276" cy="82" r="2"/><circle cx="241" cy="30" r="1.5"/>
      </g>
      <path d="M176 91h18l8-22 11 39 12-30 10 13h18" stroke={c} strokeWidth="1.5" opacity=".22" />
    </svg>
  ),
  community: (c) => (
    <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <g stroke={c} strokeWidth="1" opacity=".28">
        <path d="M132 92 174 28l42 45 48-54 53 76M174 28l90-9M216 73l101 22M132 92l84-19M174 28l143 67" />
      </g>
      <g fill={c} opacity=".32">
        <circle cx="132" cy="92" r="5"/><circle cx="174" cy="28" r="6"/><circle cx="216" cy="73" r="7"/>
        <circle cx="264" cy="19" r="5"/><circle cx="317" cy="95" r="6"/><circle cx="283" cy="62" r="3"/>
      </g>
    </svg>
  ),
  ip_momentum: (c) => {
    const bars = [44,55,49,63,58,72,68,78,83,76,91,103];
    return (
      <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none">
        <path d="M120 105h218M120 79h218M120 53h218" stroke={c} opacity=".1" />
        {bars.map((height, index) => {
          const x = 134 + index * 17;
          return <g key={x} stroke={c} opacity={0.18 + index * 0.018}>
            <path d={`M${x} ${112-height}v${Math.max(10,height-18)}`} />
            <rect x={x-4} y={104-height} width="8" height="16" fill={c} fillOpacity=".2" />
          </g>;
        })}
        <path d="m118 100 39-19 36 7 34-25 40 5 59-48" stroke={c} strokeWidth="2.2" opacity=".42" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  },
  editorial: (c) => (
    <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <g stroke={c} opacity=".2">
        <path d="M146 14v94M181 14v94M216 14v94M251 14v94M286 14v94M321 14v94" />
        <path d="M126 28h220M126 52h220M126 76h220M126 100h220" />
      </g>
      <g stroke={c} opacity=".34"><rect x="218" y="32" width="18" height="12"/><circle cx="271" cy="63" r="6"/><path d="m310 82 8-8 8 8-8 8zM168 63h26M168 87h42"/></g>
    </svg>
  ),
  competitive: (c) => (
    <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <g stroke={c} strokeWidth="1.3" opacity=".38">
        <path d="M170 15h35v20h36v25h42M170 48h35v12h36M170 105h35V85h36V60M318 15h-35v20h-42M318 105h-35V85h-42" />
      </g>
      <circle cx="241" cy="60" r="19" stroke={c} opacity=".22"/><path d="M241 41v38M222 60h38" stroke={c} opacity=".16"/>
    </svg>
  ),
  scarcity: (c) => (
    <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <g fill={c} fillOpacity=".12" stroke={c} strokeOpacity=".34">
        {[0,1,2,3,4,5,6].map((index) => {
          const x = 176 + index * 24; const h = 16 + index * 10;
          return <path key={x} d={`M${x} 104h18V${104-h}h-18z`} />;
        })}
      </g>
      <path d="M146 105h205M146 82h205M146 59h205" stroke={c} opacity=".1"/>
      <path d="m156 107 174-85" stroke={c} opacity=".2"/>
    </svg>
  ),
  jp_hype: (c) => (
    <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none">
      {[0,1,2].flatMap(row => [0,1,2,3,4,5,6].map(col => (
        <rect key={`${row}-${col}`} x={140+col*27} y={21+row*26} width="18" height="15" rx="2" fill={c} opacity={0.07+((row+col)%4)*0.045}/>
      )))}
      <circle cx="305" cy="60" r="17" stroke={c} opacity=".2"/><circle cx="305" cy="60" r="34" stroke={c} opacity=".14"/>
    </svg>
  ),
  jp_release: (c) => (
    <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M130 66h205" stroke={c} strokeWidth="1.5" opacity=".3"/>
      {[150,190,230,270,310].map((x,index)=><g key={x}><circle cx={x} cy="66" r={index===3?6:4} fill={c} opacity={index===3?'.4':'.22'}/><path d={`M${x} 39v17M${x} 76v16`} stroke={c} opacity=".18"/></g>)}
      <path d="m325 57 12 9-12 9" stroke={c} strokeWidth="2" opacity=".35"/>
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
      className={`fade-slide-up fade-slide-up-${animDelay} signal-card-row`}
      style={{
        padding: '20px 12px 22px',
        marginBottom: 8,
        borderBottom: '2px solid rgba(208, 205, 198, 0.55)',
        transition: 'background 0.12s',
        '--signal-color': meta.color,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.012)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {backdropFn && <div className="signal-card-backdrop" aria-hidden="true">{backdropFn(meta.color)}</div>}
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
