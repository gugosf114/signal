import { fetchCatalogueJSON, gateway } from './signalGateway.js';
import { fetchWithTimeout } from './http.js';
import { baseCardName } from './sourceRelevance.js';
import { isJapaneseSource } from './japaneseEvidence.js';
import { toTcgdexId } from './pokemonIds.js';

async function readJSON(url, signal) {
  try { return await fetchCatalogueJSON(url, signal); }
  catch {
    const response = await fetchWithTimeout(url, { signal }, 8000);
    if (!response.ok) return null;
    return response.json();
  }
}
export async function resolveJapaneseIdentity(cardName, pin, { signal } = {}) {
  const key = `signal_japanese_identity_v1:${pin?.game}:${pin?.printingId || pin?.id}:${cardName}`;
  try { const saved = JSON.parse(localStorage.getItem(key)); if (saved?.expires > Date.now()) return saved.value; } catch {}
  let value = { aliases: [], setNames: [], numbers: [], printingCodes: [], references: [], releaseEvidence: [], scope: 'none' };
  try {
    if (pin?.game === 'pokemon') {
      const id = toTcgdexId(pin.id || pin.printingId);
      const url = `https://api.tcgdex.net/v2/ja/cards/${encodeURIComponent(id)}`;
      const card = await readJSON(url, signal);
      if (card?.id && card.id.toLowerCase() === String(id).toLowerCase() && isJapaneseSource({ title: card.name })) {
        value = { ...value, aliases: [card.name], setNames: [card.set?.name].filter(Boolean), numbers: [card.localId].filter(Boolean), printingCodes: card.set?.cardCount?.official ? [`${card.localId}/${card.set.cardCount.official}`] : [], references: [url], scope: 'printing' };
      } else {
        const base = baseCardName(cardName, 'pokemon');
        const slug = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const speciesUrl = `https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(slug)}`;
        const species = await readJSON(speciesUrl, signal);
        if (species?.name === slug) {
          const japanese = species.names?.find(n => n.language?.name === 'ja')?.name;
          const suffix = cardName.slice(base.length).trim();
          if (japanese) value = { ...value, aliases: [`${japanese}${suffix}`], references: [speciesUrl], scope: 'name' };
        }
      }
    } else if (pin?.game === 'mtg' && pin.setId && pin.number) {
      const url = `https://api.scryfall.com/cards/${encodeURIComponent(pin.setId)}/${encodeURIComponent(pin.number)}/ja`;
      const card = await readJSON(url, signal);
      const aliases = [card?.printed_name, ...(card?.card_faces || []).map(face => face.printed_name)].filter(Boolean);
      if (card?.lang === 'ja' && card.collector_number === String(pin.number) && aliases.length) {
        value = { ...value, aliases, numbers: [card.collector_number], references: [card.scryfall_uri || url], scope: 'printing' };
        if (card.released_at) value.releaseEvidence.push({ url: card.scryfall_uri || url, title: aliases[0], summary: `Japanese printing released ${card.released_at}. ${card.name} · ${card.set.toUpperCase()} ${card.collector_number}.`, date: card.released_at, language: 'ja', area: 'jp_release', source: 'Scryfall' });
      }
    } else if (pin?.game === 'yugioh' && /^\d+$/.test(String(pin.id))) {
      const found = await gateway({ action: 'japaneseIdentity', cardId: String(pin.id) }, signal);
      if (found?.name) {
        const prefix = String(pin.number || '').split('-')[0];
        value = { ...value, aliases: [found.name], printingCodes: (found.printingCodes || []).filter(n => prefix && n.startsWith(`${prefix}-`)), references: [found.url], scope: 'card' };
        if (found.ocgDate) value.releaseEvidence.push({ url: found.dataUrl, title: `${found.name} · first OCG release`, summary: `${found.name} (${cardName}) first OCG release: ${found.ocgDate}. First TCG release: ${found.tcgDate || 'unavailable'}.`, date: found.ocgDate, language: 'ja', area: 'jp_release', source: 'YGOPRODeck' });
      }
    }
  } catch (error) { if (signal?.aborted) throw error; value.error = error.message; }
  try { if (!value.error) localStorage.setItem(key, JSON.stringify({ value, expires: Date.now() + (value.aliases.length ? 7 * 86400000 : 3600000) })); } catch {}
  return value;
}
