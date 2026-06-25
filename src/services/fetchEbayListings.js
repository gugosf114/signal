// ─── eBay live listings ───────────────────────────────────────────────────────
// Direct, structured pull via the eBay Browse API (needs VITE_EBAY_CLIENT_ID +
// VITE_EBAY_CLIENT_SECRET — free developer tier). Replaces the LLM "search eBay"
// step and returns real /itm/ URLs. No keys -> returns null and analyzeCard falls
// back to a web_search for eBay listings.

let _token = null;
let _exp = 0;

async function ebayToken() {
  const id = import.meta.env.VITE_EBAY_CLIENT_ID;
  const secret = import.meta.env.VITE_EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const now = Date.now();
  if (_token && now < _exp - 60000) return _token; // reuse until ~1 min before expiry
  const basic = btoa(`${id}:${secret}`);
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body:
      'grant_type=client_credentials&scope=' +
      encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.access_token) return null;
  _token = json.access_token;
  _exp = now + (json.expires_in || 7200) * 1000;
  return _token;
}

export async function fetchEbayListings(cardName, game = null) {
  try {
    const token = await ebayToken();
    if (!token) return null;
    const q = encodeURIComponent(`${cardName} ${game || ''} card`.trim());
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${q}&limit=20`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const items = json?.itemSummaries || [];
    const buy_it_now = [];
    const auction = [];
    for (const it of items) {
      const opts = it.buyingOptions || [];
      if (opts.includes('FIXED_PRICE') && buy_it_now.length < 2) {
        buy_it_now.push({
          title: it.title,
          price_usd: it.price ? Number(it.price.value) : 0,
          condition: it.condition || '',
          shipping:
            it.shippingOptions?.[0]?.shippingCost?.value != null
              ? `$${it.shippingOptions[0].shippingCost.value}`
              : '',
          seller: it.seller?.username || '',
          url: it.itemWebUrl || '',
        });
      } else if (opts.includes('AUCTION') && auction.length < 1) {
        auction.push({
          title: it.title,
          current_bid_usd: it.currentBidPrice
            ? Number(it.currentBidPrice.value)
            : it.price
            ? Number(it.price.value)
            : 0,
          condition: it.condition || '',
          bid_count: it.bidCount || 0,
          time_remaining: it.itemEndDate || '',
          url: it.itemWebUrl || '',
        });
      }
      if (buy_it_now.length >= 2 && auction.length >= 1) break;
    }
    return buy_it_now.length || auction.length ? { buy_it_now, auction } : null;
  } catch {
    return null;
  }
}

export function ebayBlock(data) {
  if (!data) return null;
  const lines = [
    '=== EBAY LISTINGS (pre-fetched, real /itm/ URLs — copy into ebay_listings; do NOT re-search eBay) ===',
  ];
  for (const b of data.buy_it_now || [])
    lines.push(
      `- BIN $${b.price_usd} | ${b.condition} | ${b.title} | seller ${b.seller} | ${b.url}`
    );
  for (const a of data.auction || [])
    lines.push(
      `- AUCTION $${a.current_bid_usd} (${a.bid_count} bids) | ${a.title} | ${a.url}`
    );
  return lines.join('\n');
}
