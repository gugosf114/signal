// Physical variants are separate records, even when they share a card number
// and the broad "reverse" finish. Their own USD price must travel with them.
const BASE_LABELS = { normal: 'Normal', holo: 'Holo', reverse: 'Reverse Holo',
  first_edition_normal: '1st Edition Normal', first_edition_holo: '1st Edition Holo',
  unlimited_normal: 'Unlimited Normal', unlimited_holo: 'Unlimited Holo' };
const PATTERNS = { pokeball: 'Poké Ball', masterball: 'Master Ball', greatball: 'Great Ball',
  ultraball: 'Ultra Ball', loveball: 'Love Ball', friendball: 'Friend Ball', quickball: 'Quick Ball',
  duskball: 'Dusk Ball', cosmos: 'Cosmos', galaxy: 'Galaxy', 'cracked-ice': 'Cracked Ice' };
const PRICE_KEYS = { normal: ['normal'], holo: ['holofoil'], reverse: ['reverse-holofoil', 'reverseHolofoil'],
  first_edition_normal: ['1st-edition-normal', '1stEditionNormal'],
  first_edition_holo: ['1st-edition-holofoil', '1stEditionHolofoil'],
  unlimited_normal: ['unlimited-normal', 'unlimitedNormal'],
  unlimited_holo: ['unlimited-holofoil', 'unlimitedHolofoil'] };
const clean = value => String(value || '').trim().toLowerCase();
const words = value => String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const number = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const productId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;

function variantForm(variant) {
  const type = clean(variant.type);
  if (!['normal', 'holo', 'reverse'].includes(type)) return null;
  const stamps = (variant.stamp || []).map(clean);
  if (type !== 'reverse' && stamps.some(stamp => /^1st[ -]?edition$/.test(stamp))) return `first_edition_${type}`;
  if (type !== 'reverse' && (clean(variant.subtype) === 'unlimited' || stamps.includes('unlimited'))) return `unlimited_${type}`;
  return type;
}

function variantDetails(variant, form) {
  const foil = clean(variant.foil);
  const subtype = clean(variant.subtype) === 'unlimited' ? '' : clean(variant.subtype);
  const size = clean(variant.size) === 'standard' ? '' : clean(variant.size);
  const stamps = (variant.stamp || []).map(clean).filter(stamp => !/^1st[ -]?edition$/.test(stamp) && stamp !== 'unlimited').sort();
  // Basic versions retain their existing identity, so old Normal/Holo/Reverse
  // collection entries still merge correctly. Special versions get a stable
  // discriminator independent of mutable prices and marketplace links.
  const key = foil || subtype || size || stamps.length ? JSON.stringify([foil, subtype, size, stamps]) : null;
  const label = [foil ? PATTERNS[foil] || words(foil) : null, subtype ? words(subtype) : null,
    BASE_LABELS[form], ...stamps.map(words), size ? words(size) : null].filter(Boolean).join(' · ');
  return { key, label };
}

export function pokemonVariantRows(card, base = {}) {
  if (!Array.isArray(card?.variants_detailed) || !card.variants_detailed.length) return [];
  base = {
    game: 'pokemon', id: card.id, printingId: card.id, name: card.name,
    number: card.localId, setId: card.set?.id, setName: card.set?.name,
    printedTotal: card.set?.cardCount?.official || null,
    setCode: card.set?.abbreviation?.official || card.set?.id,
    rarity: card.rarity, source: 'tcgdex',
    imageUrl: card.image ? `${card.image}/low.webp` : null,
    imageLarge: card.image ? `${card.image}/high.webp` : null,
    ...base,
  };
  const rows = [];
  for (const variant of card.variants_detailed) {
    if (variant.languages?.length && !variant.languages.includes('en')) continue;
    const form = variantForm(variant);
    if (!form) continue;
    const { key, label } = variantDetails(variant, form);
    const linkedId = productId(variant.thirdParty?.tcgplayer);
    // Parent pricing is safe only for ordinary variants without their own
    // price map. A special pattern must never borrow the parent's price.
    const pricing = variant.pricing?.tcgplayer || (!key ? card.pricing?.tcgplayer : null);
    const entries = pricing?.unit && pricing.unit !== 'USD' ? [] : Object.entries(pricing || {})
      .filter(([, value]) => value && typeof value === 'object'
        && (!linkedId || !value.productId || productId(value.productId) === linkedId));
    let chosen = entries.find(([name]) => PRICE_KEYS[form].includes(name));
    // Pattern cards such as Master Ball are physically reverse holos, but
    // TCGplayer lists their dedicated product under its "holofoil" bucket.
    if (!chosen && key && entries.length === 1) chosen = entries[0];
    const price = number(chosen?.[1]?.marketPrice);
    const id = linkedId || productId(chosen?.[1]?.productId);
    rows.push({ ...base, form, finish: label,
      pokemonVariantsResolved: true,
      pokemonVariantGenerated: variant.variantId === 'generated',
      pokemonVariantId: variant.variantId && variant.variantId !== 'generated' ? String(variant.variantId) : null,
      pokemonVariantKey: key,
      pokemonVariantLabel: label,
      pokemonPriceKey: chosen?.[0] || null,
      pokemonVerifiedProductId: null,
      pokemonProductBinding: null,
      pokemonProductCheckedAt: null,
      pokemonCatalogImageUrl: base.imageUrl || null,
      pokemonCatalogImageLarge: base.imageLarge || base.imageUrl || null,
      tcgplayerProductId: id,
      pokemonCatalogProductId: id,
      price, marketPrices: { [form]: price }, availableFinishes: [form],
      priceSource: price === null ? null : 'TCGplayer',
      priceScope: 'exact finish',
    });
  }
  return rows.map(row => ({ ...row,
    pokemonProductCandidates: [...new Set(rows.map(other => other.tcgplayerProductId).filter(Boolean))],
    pokemonImageShared: rows.length > 1,
    pokemonProductImageShared: !!row.tcgplayerProductId && rows.filter(other => other.tcgplayerProductId === row.tcgplayerProductId).length > 1,
  }));
}

export function selectedPokemonVariant(card, pin) {
  const rows = pokemonVariantRows(card);
  return rows.find(row => pin.pokemonVariantId && row.pokemonVariantId === pin.pokemonVariantId)
    || rows.find(row => row.form === pin.form && row.pokemonVariantKey === (pin.pokemonVariantKey || null))
    || null;
}

export function pokemonFinishLabel(card, form = card?.form) {
  return card?.pokemonVariantsResolved && form === card.form
    ? card.pokemonVariantLabel || card.finish || BASE_LABELS[form]
    : BASE_LABELS[form] || card?.finish || null;
}

export function pokemonMarketForm(card) {
  return Object.entries(PRICE_KEYS).find(([, keys]) => keys.includes(card?.pokemonPriceKey))?.[0] || card?.form;
}

export function pokemonVariantFields(current = {}, fallback = {}) {
  const source = current.pokemonVariantsResolved ? current : fallback.pokemonVariantsResolved ? fallback : current;
  return {
    pokemonVariantsResolved: Boolean(source.pokemonVariantsResolved),
    pokemonVariantGenerated: source.pokemonVariantGenerated == null ? null : Boolean(source.pokemonVariantGenerated),
    pokemonVariantId: source.pokemonVariantId || null,
    pokemonVariantKey: source.pokemonVariantKey || null,
    pokemonVariantLabel: source.pokemonVariantLabel || null,
    pokemonPriceKey: source.pokemonPriceKey || null,
    pokemonImageShared: source.pokemonImageShared ?? null,
    pokemonProductImageShared: source.pokemonProductImageShared ?? null,
    pokemonProductCandidates: Array.isArray(source.pokemonProductCandidates) ? source.pokemonProductCandidates : null,
    pokemonVerifiedProductId: source.pokemonVerifiedProductId || null,
    pokemonProductBinding: source.pokemonProductBinding || null,
    pokemonCatalogProductId: source.pokemonCatalogProductId || null,
    pokemonProductCheckedAt: source.pokemonProductCheckedAt || null,
    pokemonCatalogImageUrl: source.pokemonCatalogImageUrl || null,
    pokemonCatalogImageLarge: source.pokemonCatalogImageLarge || null,
  };
}
