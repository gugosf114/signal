import React, { useEffect, useState } from 'react';
import { getScoreLabel, GAME_LABELS, SCORE_VERSION, SIGNAL_TYPES } from '../config/signals';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWatchedCards } from './WatchedCards';
import CardImage from './CardImage';
import CardLightbox from './CardLightbox';
import { printingIdentity, printingLabel } from '../services/printing';
import PriceComparison from './PriceComparison';
import { reportMarketPrice } from '../services/reportDisplay';
import { normalizeCardRecord } from '../services/cardRecord';
import { isExactScanTarget } from '../services/scanIdentity';

export default function OverallScore({ score, cardName, game, summary, truncated = false, signalCount = 0, expectedSignalCount = 8, sourcedSignalCount = 0, uniqueSourceCount = 0, onRetry, signals = [], enPrice, onCardImageLoaded, printing = null, pin = null, prices = null, onAdd = null }) {
  const { label, blurb } = getScoreLabel(score);
  const gameMeta = GAME_LABELS[game];
  const glowColor = gameMeta?.color || '#C44040';
  const isMobile = useIsMobile();
  const [percentileInfo, setPercentileInfo] = useState(null);
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { toggle: toggleWatch, isWatched } = useWatchedCards();
  const watched = isWatched(cardName, game, pin);
  const exactCard = pin || printing;

  useEffect(() => {
    if (score === null || score === undefined || !cardName || truncated) return;
    try {
      const raw = localStorage.getItem('signal_score_history');
      const parsedHistory = raw ? JSON.parse(raw) : [];
      const history = (Array.isArray(parsedHistory) ? parsedHistory : []).map((item) => {
        const exactPin = normalizeCardRecord(item?.pin || {}, {
          name: item?.cardName,
          game: item?.game,
        });
        return exactPin && isExactScanTarget(exactPin.game, exactPin)
          ? { ...item, cardName: exactPin.name, game: exactPin.game, pin: exactPin }
          : null;
      }).filter(Boolean);
      const identity = printingIdentity(pin);
      const entry = { score, scoreVersion: SCORE_VERSION, date: new Date().toISOString(), cardName, game, pin };
      const deduped = [entry, ...history.filter((item) => {
        const otherIdentity = printingIdentity(item?.pin);
        return !(item.cardName === cardName && item.game === game && otherIdentity === identity);
      })];
      const trimmed = deduped.slice(0, 100);
      localStorage.setItem('signal_score_history', JSON.stringify(trimmed));
      try {
        const recentRaw = localStorage.getItem('signal_recent_scans');
        const parsedRecent = recentRaw ? JSON.parse(recentRaw) : [];
        const recent = Array.isArray(parsedRecent) ? parsedRecent : [];
        const recentEntry = { name: cardName, game, score, scoreVersion: SCORE_VERSION, scoredAt: entry.date, pin };
        const recentNew = [recentEntry, ...recent.filter((item) => {
          const otherIdentity = printingIdentity(item?.pin);
          return !(item.name === cardName && item.game === game && otherIdentity === identity);
        })].slice(0, 8);
        localStorage.setItem('signal_recent_scans', JSON.stringify(recentNew));
        window.dispatchEvent(new Event('signal-history-updated'));
      } catch {}
      const comparable = trimmed.filter((item) => item.scoreVersion === SCORE_VERSION && Number.isFinite(item.score));
      if (comparable.length >= 5) {
        const allScores = comparable.map((item) => item.score);
        const lowerCount = allScores.filter((value) => value < score).length;
        const topPct = 100 - Math.round((lowerCount / allScores.length) * 100);
        setPercentileInfo({ topPct, total: comparable.length });
      } else {
        setPercentileInfo(null);
      }
    } catch {}
  }, [score, cardName, game, pin, truncated]);

  const hasAttention = Number.isFinite(score) && sourcedSignalCount > 0;
  const finding = summary || (hasAttention ? blurb : '');
  const marketPrice = reportMarketPrice(enPrice);
  const priceText = marketPrice === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(marketPrice);
  const attentionLabel = hasAttention ? `${label.charAt(0)}${label.slice(1).toLowerCase()} attention` : 'Attention unavailable';
  const printingDetails = printingLabel({ ...(exactCard || {}), setName: null });
  return <>
    <section className="report-summary" aria-label="Card report">
      <div className="report-card-heading">
        <div className="report-card-art">
          <CardImage cardName={cardName} game={game} pin={pin} size={isMobile ? 180 : 250} glowColor={glowColor}
            onLoad={(url) => { setCardImageUrl(url); onCardImageLoaded?.(url); }} onClick={() => setLightboxOpen(true)} />
        </div>
        <div className="report-card-identity">
          {gameMeta && <span className="report-game">{gameMeta.label}</span>}
          <h1>{cardName}</h1>
          {exactCard?.setName && <span className="report-set-name">{exactCard.setName}</span>}
          {printingDetails && <p className="report-printing">{printingDetails}</p>}
          <div className="report-market price-cell--market">
            <span>Market price</span>
            <strong className={marketPrice === null ? 'report-price-unavailable' : ''}>{priceText}</strong>
          </div>
        </div>
      </div>
      <div className="report-finding">
        <div className="report-finding-heading"><h2>{attentionLabel}</h2>{hasAttention && <span className="report-attention-score">{score}<small>/100</small></span>}</div>
        {finding && <p>{finding}</p>}
        <details className="report-evidence">
          <summary>Sources</summary>
          <p>{sourcedSignalCount} of {expectedSignalCount} areas have sources. {uniqueSourceCount} source{uniqueSourceCount === 1 ? '' : 's'} linked in the report.</p>
          {signals.some((signal) => !signal.sources?.length) && (
            <details className="report-empty-areas">
              <summary>Areas without sources</summary>
              <ul>{signals.filter((signal) => !signal.sources?.length).map((signal) => (
                <li key={signal.key}>{SIGNAL_TYPES[signal.key]?.label || signal.key}</li>
              ))}</ul>
            </details>
          )}
          {hasAttention && percentileInfo && <p>Top {percentileInfo.topPct}% of your last {percentileInfo.total} scans by attention.</p>}
        </details>
        {truncated && <div className="report-partial"><span>Partial report · {signalCount} of {expectedSignalCount} areas</span>{onRetry && <button type="button" className="score-retry-button" onClick={onRetry}>Retry</button>}</div>}
      </div>
      <PriceComparison data={prices} />
      <div className="report-primary-actions">
        {onAdd && <button type="button" className="result-add-button" onClick={onAdd} aria-label={`Add ${cardName || 'card'} to collection`}><span aria-hidden="true">＋</span>Add to Collection</button>}
        <button type="button" className={`report-watch score-watch-button${watched ? ' score-watch-button--on' : ''}`} onClick={() => toggleWatch({ name: cardName, game, score, enPrice, pin })} aria-pressed={watched} aria-label={watched ? `Stop watching ${cardName}` : `Watch ${cardName}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill={watched ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg>{watched ? 'Watching' : 'Watch'}
        </button>
      </div>
    </section>
    <CardLightbox card={exactCard} isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} imageUrl={cardImageUrl} cardName={cardName} cardMeta={[printingLabel(exactCard), marketPrice === null ? null : priceText].filter(Boolean).join(' · ')} />
  </>;
}
