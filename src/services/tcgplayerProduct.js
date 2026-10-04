import { fetchWithTimeout } from './http.js';
import { gateway, fetchCatalogueJSON } from './signalGateway.js';

const TTL = 5 * 60 * 1000;
const products = new Map();
const searches = new Map();
const providerSets = new Map();
const setKey = value => String(value || '').replace(/^[A-Z0-9]{1,8}:\s*/, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function fetchTcgplayerProduct(productId, signal) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const cached = products.get(id);
  if (cached && Date.now() - cached.at < TTL) return cached.promise;
  if (products.size >= 128) products.delete(products.keys().next().value);
  const promise = (async () => {
    const url = `https://mp-search-api.tcgplayer.com/v2/product/${id}/details`;
    let data = null;
    try {
      const response = await fetchWithTimeout(url, { signal, headers: { Accept: 'application/json' } }, 6000);
      if (response.ok) data = await response.json();
    } catch (error) { if (signal?.aborted) throw error; }
    if (!data) data = await fetchCatalogueJSON(url, signal).catch(error => { if (signal?.aborted) throw error; return null; });
    return Number(data?.productId) === id ? data : null;
  })();
  products.set(id, { at: Date.now(), promise });
  try { const result = await promise; if (!result) products.delete(id); return result; }
  catch (error) { products.delete(id); throw error; }
}

export async function searchTcgplayerCatalog(query, { game = 'mtg', setName = '', signal } = {}) {
  const providerSet = providerSets.get(`${game}:${setKey(setName)}`) || setName;
  const key = JSON.stringify([game, query, providerSet]);
  const learnSet = rows => {
    const match = rows.find(row => setKey(row.setName) === setKey(setName));
    if (match?.setName) providerSets.set(`${game}:${setKey(setName)}`, match.setName);
    return rows;
  };
  const cached = searches.get(key);
  if (cached && Date.now() - cached.at < TTL) return cached.promise;
  if (searches.size >= 64) searches.delete(searches.keys().next().value);
  const promise = (async () => {
    try {
      const term = { productLineName: [game === 'mtg' ? 'Magic' : game === 'pokemon' ? 'Pokemon' : 'YuGiOh'] };
      if (providerSet) term.setName = [providerSet];
      const response = await fetchWithTimeout(`https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(query)}&isList=false`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: 'sales_exp_fields_synonym', from: 0, size: 50,
          filters: { term, range: {}, match: {} }, context: { cart: {}, shippingCountry: 'US' },
          settings: { useFuzzySearch: true }, sort: {} }),
      }, 6000);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.results?.[0]?.results)) return learnSet(data.results[0].results);
      }
    } catch (error) { if (signal?.aborted) throw error; }
    try { const data = await gateway({ action: 'tcgplayerSearch', query, setName: providerSet, game }, signal, 0); return learnSet(data?.products || []); }
    catch (error) { if (signal?.aborted) throw error; return []; }
  })();
  searches.set(key, { at: Date.now(), promise });
  try { const result = await promise; if (!result.length) searches.delete(key); return result; }
  catch (error) { searches.delete(key); throw error; }
}

// Exact English Near Mint finish prices, used when a product combines finishes.
const histories = new Map();
export async function fetchTcgplayerSkuMarket(productId, variant, { signal, now = Date.now() } = {}) {
  const id = Number(productId);
  const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  let cached = histories.get(id);
  if (!cached || now - cached.at > TTL) {
    const promise = (async () => {
      const url = `https://infinite-api.tcgplayer.com/price/history/${id}/detailed?range=month`;
      try {
        const response = await fetchWithTimeout(url, { signal }, 6000);
        if (response.ok) return response.json();
      } catch (error) { if (signal?.aborted) throw error; }
      return fetchCatalogueJSON(url, signal).catch(() => null);
    })();
    cached = { at: now, promise }; histories.set(id, cached);
    if (histories.size > 128) histories.delete(histories.keys().next().value);
  }
  const payload = await cached.promise;
  if (!payload) { histories.delete(id); return null; }
  const matches = (payload.result || []).filter(sku => normalized(sku.language) === 'english'
    && normalized(sku.condition) === 'nearmint' && normalized(sku.variant) === normalized(variant));
  if (matches.length !== 1) return null;
  const latest = (matches[0].buckets || []).map(bucket => ({ price: Number(bucket.marketPrice), at: Date.parse(bucket.bucketStartDate) }))
    .filter(point => point.price > 0 && Number.isFinite(point.at) && point.at <= now && now - point.at <= 7 * 86400000)
    .sort((a, b) => b.at - a.at)[0];
  return latest ? { price: latest.price, asOf: new Date(latest.at).toISOString() } : null;
}
