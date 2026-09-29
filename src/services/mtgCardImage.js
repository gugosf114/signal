import { tcgplayerProductImageUrl } from './fetchTcgplayerPrice.js';

const checks = new Map();
function browserImageExists(url) {
  if (typeof Image === 'undefined') return Promise.resolve(false);
  if (checks.has(url)) return checks.get(url);
  const promise = new Promise(resolve => {
    const image = new Image();
    const finish = ok => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (!ok) image.src = '';
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 3000);
    image.onload = () => finish(image.naturalWidth >= 300 && image.naturalHeight >= 400);
    image.onerror = () => finish(false);
    image.src = url;
  });
  if (checks.size >= 128) checks.delete(checks.keys().next().value);
  checks.set(url, promise);
  return promise;
}

// Use only the product ID supplied for this exact catalog printing. A name
// search can return another treatment. This image lookup never changes price.
export async function resolveMtgCardImage(card, { signal, checkImage = browserImageExists } = {}) {
  if (!card || !['mtg', 'pokemon'].includes(card.game)) return card;
  if (card.game === 'pokemon' && !card.pokemonVariantsResolved) return card;
  if (signal?.aborted) throw new DOMException('Image lookup cancelled.', 'AbortError');
  const id = card.game === 'pokemon' ? card.tcgplayerProductId
    : card.tcgplayerProductIds && Object.hasOwn(card.tcgplayerProductIds, card.form)
    ? card.tcgplayerProductIds[card.form]
    : card.form === 'etched' && card.tcgplayerEtchedId ? card.tcgplayerEtchedId : card.tcgplayerProductId;
  const imageUrl = tcgplayerProductImageUrl(id);
  if (!imageUrl) return card;
  const available = await checkImage(imageUrl).catch(() => false);
  if (signal?.aborted) throw new DOMException('Image lookup cancelled.', 'AbortError');
  if (!available) return card;
  const forms = card.availableFinishes || [];
  const shared = card.tcgplayerProductIds
    ? forms.filter(form => card.tcgplayerProductIds[form] === id)
    : card.form === 'etched' && card.tcgplayerEtchedId
      ? [] : forms.filter(form => form !== 'etched' || !card.tcgplayerEtchedId);
  return {
    ...card,
    imageUrl,
    imageLarge: imageUrl,
    imageSource: 'tcgplayer',
    tcgplayerImageUrl: imageUrl,
    imageSharedFinishes: shared.length > 1 ? shared : [],
    ...(card.game === 'pokemon' ? { pokemonImageShared: Boolean(card.pokemonProductImageShared) } : {}),
  };
}

// Both games use IDs provided by their catalog, never a name-only image match.
export const resolveCardProductImage = resolveMtgCardImage;
