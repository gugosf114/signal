import { fetchWithTimeout } from './http.js';
import { gateway } from './signalGateway.js';

const TTL = 5 * 60 * 1000;
const products = new Map();
const searches = new Map();

export async function fetchTcgplayerProduct(productId, signal) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const cached = products.get(id);
  if (cached && Date.now() - cached.at < TTL) return cached.promise;
  if (products.size >= 128) products.delete(products.keys().next().value);
  const promise = fetchWithTimeout(`https://mp-search-api.tcgplayer.com/v2/product/${id}/details`,
    { signal, headers: { Accept: 'application/json' } }, 6000)
    .then(async response => {
      if (!response.ok) return null;
      const data = await response.json();
      return Number(data?.productId) === id ? data : null;
    }).catch(error => { if (signal?.aborted) throw error; return null; });
  products.set(id, { at: Date.now(), promise });
  try { const result = await promise; if (!result) products.delete(id); return result; }
  catch (error) { products.delete(id); throw error; }
}

export async function searchTcgplayerCatalog(query, { game = 'mtg', setName = '', signal } = {}) {
  const key = JSON.stringify([game, query, setName]);
  const cached = searches.get(key);
  if (cached && Date.now() - cached.at < TTL) return cached.promise;
  if (searches.size >= 64) searches.delete(searches.keys().next().value);
  const promise = (async () => {
    try {
      const term = { productLineName: [game === 'mtg' ? 'Magic' : game === 'pokemon' ? 'Pokemon' : 'YuGiOh'] };
      if (setName) term.setName = [setName];
      const response = await fetchWithTimeout(`https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(query)}&isList=false`, {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: 'sales_exp_fields_synonym', from: 0, size: 50,
          filters: { term, range: {}, match: {} }, context: { cart: {}, shippingCountry: 'US' },
          settings: { useFuzzySearch: true }, sort: {} }),
      }, 6000);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.results?.[0]?.results)) return data.results[0].results;
      }
    } catch (error) { if (signal?.aborted) throw error; }
    try { const data = await gateway({ action: 'tcgplayerSearch', query, setName, game }, signal, 0); return data?.products || []; }
    catch (error) { if (signal?.aborted) throw error; return []; }
  })();
  searches.set(key, { at: Date.now(), promise });
  try { const result = await promise; if (!result.length) searches.delete(key); return result; }
  catch (error) { searches.delete(key); throw error; }
}
