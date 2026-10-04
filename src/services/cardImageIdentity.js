const key = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function yugiohBaseName(value) {
  return String(value || '').replace(/(?:\s*\([^)]*\))+\s*$/, '').trim();
}
export function yugiohImageIdentity(card) {
  return [key(yugiohBaseName(card?.baseName || card?.name)), key(card?.setName), key(card?.number || card?.setCode), key(card?.rarity), Number(card?.tcgplayerProductId) || ''].join('::');
}
export function productImageUrl(id) {
  return Number.isSafeInteger(Number(id)) && Number(id) > 0 ? `https://product-images.tcgplayer.com/${Number(id)}.jpg` : null;
}
export function verifiedYugiohImage(card) {
  const url = productImageUrl(card?.tcgplayerProductId);
  return Boolean(card?.game === 'yugioh' && card.name && card.setName && card.number && card.rarity && url
    && card.imageIdentity === yugiohImageIdentity(card)
    && card.imageSource === 'tcgplayer' && card.imageUrl === url && card.imageLarge === url);
}
export function stampYugiohProductImage(card) {
  const url = productImageUrl(card?.tcgplayerProductId);
  if (!url || !card?.name || !card?.setName || !card?.number || !card?.rarity) return card;
  return { ...card, imageUrl: url, imageLarge: url, tcgplayerImageUrl: url, imageSource: 'tcgplayer', imageIdentity: yugiohImageIdentity(card), imageStatus: 'matched' };
}
export function cardVersionLabel(card) {
  const labels = [knownRarity(card?.rarity) ? card.rarity : null, card?.artVariant, card?.finish || (card?.form === 'foil' ? 'Foil' : card?.form === 'etched' ? 'Etched foil' : null)].filter(Boolean);
  return [...new Map(labels.map(label => [String(label).toLowerCase(), label])).values()].join(' · ');
}

export function knownRarity(value) {
  return Boolean(value && !/^(?:new|unknown|n\/?a|none|tbd|not specified)$/i.test(String(value).trim()));
}
export function productArtVariant(name) {
  const text = String(name || '');
  if (/extended[ -]art/i.test(text)) return 'Extended art';
  if (/(?:alternate|alternative)[ -]art/i.test(text)) return 'Alternate art';
  if (/full[ -]art/i.test(text)) return 'Full art';
  if (/borderless/i.test(text)) return 'Borderless';
  return 'Standard art';
}
