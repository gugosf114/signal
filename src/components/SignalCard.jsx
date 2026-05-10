import React, { useState } from 'react';
import HeatBar from './HeatBar';
import SourceCitation from './SourceCitation';
import { SIGNAL_TYPES } from '../config/signals';
import { extractYouTubeId } from '../config/brandIcons';

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
  jp_price: (c) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <text x="8" y="12" textAnchor="middle" fontSize="12" fill={c} opacity="0.6"
        fontWeight="700" fontFamily="'JetBrains Mono'">¥</text>
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
  const meta = SIGNAL_TYPES[signal.key];
  if (!meta) return null;

  const isHot = signal.level >= 4;
  const markFn = MARKS[signal.key];

  const preview = signal.detail
    ? signal.detail.substring(0, 72) + (signal.detail.length > 72 ? '…' : '')
    : meta.description;

  const toggle = () => setExpanded(e => !e);

  // Separate YouTube from other sources for M2 2-up grid
  const sources = Array.isArray(signal.sources) ? signal.sources : [];
  const ytSources = sources.filter(s => extractYouTubeId(s.url));
  const otherSources = sources.filter(s => !extractYouTubeId(s.url));

  return (
    <div
      id={`signal-${signal.key}`}
      className={`fade-slide-up fade-slide-up-${animDelay} signal-card-row`}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      style={{
        padding: '14px 0',
        borderBottom: `1px solid ${isJapan ? 'rgba(196,64,64,0.06)' : '#14161A'}`,
        cursor: 'pointer',
        transition: 'background 0.12s',
        '--signal-color': meta.color,
      }}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.012)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
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
            color: isHot ? meta.color : '#6B6860',
            flex: 1,
            minWidth: 0,
          }}
        >
          {meta.label}
        </span>

        <HeatBar level={signal.level} color={meta.color} />

        <span style={{
          fontSize: 11,
          color: '#5A5850',
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s',
          fontFamily: "'JetBrains Mono'",
          flexShrink: 0,
        }}>&#9658;</span>
      </div>

      {/* Preview */}
      {!expanded && (
        <div style={{
          fontSize: 11,
          color: '#3A3830',
          marginTop: 4,
          marginLeft: 26,
          lineHeight: 1.5,
          fontFamily: "'Syne', sans-serif",
          fontWeight: 400,
        }}>
          {preview}
        </div>
      )}

      {/* Expanded evidence */}
      <div className={`signal-evidence ${expanded ? 'expanded' : ''}`}>
        <div>
          {expanded && (
            <div style={{
              marginTop: 10,
              marginLeft: 26,
              paddingLeft: 14,
              borderLeft: `1px solid ${isJapan ? 'rgba(196,64,64,0.12)' : '#1A1D24'}`,
            }}>
              <div style={{
                fontSize: 13,
                color: '#5A5850',
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
                  <div style={{
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    fontFamily: "'Syne', sans-serif",
                    textTransform: 'uppercase',
                    color: '#3A3830',
                    marginBottom: 6,
                  }}>
                    Sources · {sources.length}
                  </div>

                  {/* YouTube citations — 2-up grid on desktop when ≥2 */}
                  {ytSources.length >= 2 ? (
                    <div className="yt-sources-grid">
                      {ytSources.map((src, idx) => (
                        <SourceCitation key={idx} source={src} />
                      ))}
                    </div>
                  ) : (
                    ytSources.map((src, idx) => (
                      <SourceCitation key={idx} source={src} />
                    ))
                  )}

                  {/* Non-YouTube citations — always single column */}
                  {otherSources.map((src, idx) => (
                    <SourceCitation key={'o' + idx} source={src} />
                  ))}
                </div>
              )}

              {sources.length === 0 && (
                <div style={{
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(26, 29, 36, 0.4)',
                  fontSize: 10,
                  color: '#2A2820',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.06em',
                }}>
                  // no verified sources for this signal
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
