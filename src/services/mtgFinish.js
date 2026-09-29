// Scryfall's finish (nonfoil/foil/etched) selects the price bucket. Its promo
// tags describe the physical foil treatment. Keep those two facts separate.
const FOIL_TREATMENTS = {
  surgefoil: 'Surge Foil', galaxyfoil: 'Galaxy Foil', halofoil: 'Halo Foil',
  confettifoil: 'Confetti Foil', fracturefoil: 'Fracture Foil',
  fracturedfoil: 'Fractured Foil', ripplefoil: 'Ripple Foil',
  textured: 'Textured Foil', texturedfoil: 'Textured Foil',
  raisedfoil: 'Raised Foil', manafoil: 'Mana Foil', cosmicfoil: 'Cosmic Foil',
  rainbowfoil: 'Rainbow Foil', doublerainbow: 'Double Rainbow Foil',
  silverfoil: 'Silver Foil', gilded: 'Gilded Foil',
  stepandcompleat: 'Step-and-Compleat Foil', oilraised: 'Oil-Slick Raised Foil',
};

export function mtgCardNames(card) {
  return [...new Set([card?.flavor_name, card?.name, card?.printed_name,
    ...(card?.card_faces || []).flatMap(face => [face.flavor_name, face.name, face.printed_name])]
    .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
}

export function mtgNamedFoils(text) {
  const key = value => String(value).toLowerCase().replace(/fractured/g, 'fracture').replace(/[^a-z0-9]/g, '');
  let value = key(text);
  const found = [];
  for (const label of [...new Set(Object.values(FOIL_TREATMENTS).map(key))].sort((a, b) => b.length - a.length)) {
    const token = value.includes(label) ? label : label.replace(/foil$/, '');
    if (token && value.includes(token)) { found.push(label); value = value.replace(token, ''); }
  }
  return found;
}

export function mtgPromoTypes(card) {
  const values = card?.promoTypes || card?.promo_types || [];
  return [...new Set((Array.isArray(values) ? values : [])
    .filter(value => typeof value === 'string').map(value => value.trim().toLowerCase()).filter(Boolean))];
}

export function mtgFinishLabel(card, form = card?.form) {
  if (form === 'normal' || form === 'nonfoil') return 'Non-foil';
  if (form === 'etched') return 'Etched';
  if (form !== 'foil') return card?.finish || null;
  const labels = mtgPromoTypes(card).map(tag => FOIL_TREATMENTS[tag]
    || (/^[a-z]+foil$/.test(tag) ? `${tag.slice(0, -4).replace(/^./, c => c.toUpperCase())} Foil` : null))
    .filter(Boolean);
  if (labels.length) return [...new Set(labels)].join(' / ');
  const supplied = String(card?.finish || '').trim();
  return supplied && !/^(?:normal|non-foil|foil|etched)$/i.test(supplied) ? supplied : 'Foil';
}

export function sharedCardImageNote(card) {
  if (card?.game === 'pokemon') return card.pokemonImageShared ? 'Catalog photo shared by several versions.' : null;
  const forms = card?.imageSharedFinishes;
  if (!Array.isArray(forms) || forms.length < 2) return null;
  return `Photo shared by ${forms.map(form => mtgFinishLabel(card, form)).join(' and ')}.`;
}
