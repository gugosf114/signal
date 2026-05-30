import React from 'react';
import { BrandIcon } from '../config/brandIcons';
import { useIsMobile } from '../hooks/useIsMobile';

function formatUSD(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '—';
  const num = Number(n);
  return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

const sectionLabelStyle = {
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: '0.18em',
  fontFamily: "'Syne', sans-serif",
  textTransform: 'uppercase',
  color: '#4A4840',
};

const typeChipStyle = {
  display: 'inline-block',
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: '0.14em',
  fontFamily: "'Syne', sans-serif",
  textTransform: 'uppercase',
  padding: '2px 6px',
  borderRadius: 2,
  marginBottom: 6,
};

const priceStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 600,
  fontSize: 20,
  lineHeight: 1.1,
};

const titleStyle = {
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  color: '#6B6860',
  lineHeight: 1.4,
  marginTop: 6,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const metaStyle = {
  fontSize: 9,
  fontFamily: "'JetBrains Mono', monospace",
  color: '#5A5850',
  marginTop: 6,
  lineHeight: 1.5,
};

const linkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 9,
  fontFamily: "'Syne', sans-serif",
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#A09060',
  textDecoration: 'none',
  marginTop: 10,
};

function BinCard({ listing }) {
  if (!listing) return null;
  return (
    <div style={{
      padding: '14px 14px 12px',
      background: '#0A0C10',
      border: '1px solid #1A1D24',
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        ...typeChipStyle,
        color: '#608870',
        background: 'rgba(96, 136, 112, 0.08)',
        border: '1px solid rgba(96, 136, 112, 0.3)',
      }}>
        Buy It Now
      </div>
      <div style={{ ...priceStyle, color: '#E8E4DC' }}>{formatUSD(listing.price_usd)}</div>
      <div style={titleStyle}>{listing.title || '—'}</div>
      <div style={metaStyle}>
        {listing.condition || 'condition unknown'}
        {listing.shipping && listing.shipping !== 'unknown' && ` · ${listing.shipping} ship`}
        {listing.seller && (
          <>
            <br />
            <span style={{ color: '#3A3830' }}>{listing.seller}</span>
          </>
        )}
      </div>
      {listing.url && (
        <a href={listing.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          View on eBay →
        </a>
      )}
    </div>
  );
}

function AuctionCard({ listing }) {
  if (!listing) return null;
  return (
    <div style={{
      padding: '14px 14px 12px',
      background: '#0A0C10',
      border: '1px solid #1A1D24',
      borderRadius: 2,
      borderLeft: '2px solid #C44040',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        ...typeChipStyle,
        color: '#C44040',
        background: 'rgba(196, 64, 64, 0.08)',
        border: '1px solid rgba(196, 64, 64, 0.3)',
      }}>
        Auction
      </div>
      <div style={{ ...priceStyle, color: '#E8E4DC' }}>
        {formatUSD(listing.current_bid_usd)}
        <span style={{ fontSize: 9, color: '#5A5850', marginLeft: 6, fontFamily: "'Syne', sans-serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          current bid
        </span>
      </div>
      <div style={titleStyle}>{listing.title || '—'}</div>
      <div style={metaStyle}>
        {listing.condition || 'condition unknown'}
        {typeof listing.bid_count === 'number' && ` · ${listing.bid_count} bid${listing.bid_count === 1 ? '' : 's'}`}
        {listing.time_remaining && (
          <>
            <br />
            <span style={{ color: '#C44040', fontWeight: 600 }}>{listing.time_remaining} remaining</span>
          </>
        )}
      </div>
      {listing.url && (
        <a href={listing.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Bid on eBay →
        </a>
      )}
    </div>
  );
}

export default function EbayListings({ data }) {
  const isMobile = useIsMobile();
  if (!data) return null;
  const bin = Array.isArray(data.buy_it_now) ? data.buy_it_now : [];
  const auction = Array.isArray(data.auction) ? data.auction : [];
  if (bin.length === 0 && auction.length === 0) return null;

  const cards = [
    ...bin.slice(0, 2).map((l, i) => <BinCard key={`bin-${i}`} listing={l} />),
    ...auction.slice(0, 1).map((l, i) => <AuctionCard key={`auc-${i}`} listing={l} />),
  ];

  return (
    <div className="fade-slide-up" style={{
      marginBottom: 40,
      paddingTop: 14,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <div style={sectionLabelStyle}>Active Listings</div>
        <div style={{
          flex: 1,
          height: 1,
          background: 'linear-gradient(90deg, #1A1D24, transparent)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <BrandIcon brand="ebay" size={12} />
          <span style={{
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#5A5850',
            letterSpacing: '0.04em',
          }}>
            eBay · live
          </span>
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${cards.length}, 1fr)`,
        gap: 8,
      }}>
        {cards}
      </div>
    </div>
  );
}
