const clean = value => String(value || '').trim();
const unknown = value => /unknown|unable|unreadable|not (?:clear|visible)/i.test(value);

// Printed numbers may omit zero padding. Prefixes such as TG, GG and SWSH
// are part of the number and must not collapse into an ordinary numbered card.
export function collectorNumber(value) {
  return clean(value).toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]*)0+(\d)/, '$1$2');
}

export function sameCollectorNumber(left, right) {
  const a = collectorNumber(left), b = collectorNumber(right);
  return Boolean(a && b && a === b);
}

const PROMO_SERIES = { SWSH: 'swshp', SM: 'smp', XY: 'xyp', BW: 'bwp', DP: 'dpp', HGSS: 'hgssp' };
const SET_ALIASES = {
  scarletvioletblackstarpromos: 'svp', scarletvioletpromos: 'svp', svpblackstarpromos: 'svp',
  swordshieldblackstarpromos: 'swshp', swordshieldpromos: 'swshp', swshblackstarpromos: 'swshp',
  sunmoonblackstarpromos: 'smp', sunmoonpromos: 'smp', smblackstarpromos: 'smp',
  xyblackstarpromos: 'xyp', blackwhiteblackstarpromos: 'bwp', bwblackstarpromos: 'bwp',
  diamondpearlblackstarpromos: 'dpp', dpblackstarpromos: 'dpp',
  heartgoldsoulsilverblackstarpromos: 'hgssp', hgssblackstarpromos: 'hgssp',
};

function setKey(value) {
  const key = clean(value).toLowerCase().replace(/\band\b/g, '').replace(/[^a-z0-9]/g, '');
  return SET_ALIASES[key] || key;
}

export function scannedPrintingTarget(input = {}) {
  let set = unknown(clean(input.set)) ? '' : clean(input.set);
  const raw = unknown(clean(input.number)) ? '' : clean(input.number);
  const [left, denominator] = raw.split('/');
  let number = clean(left).replace(/^(?:no\.?\s+|#\s*)/i, '');
  const total = /^\d+$/.test(clean(denominator)) ? Number(denominator) : null;
  if (input.game === 'pokemon') {
    number = number.replace(/[★☆]/g, '').trim();
    const promo = number.match(/^(SVP|MEP)(?:\s*(?:ENG|EN))?[\s-]*(\d{1,4})$/i);
    const olderPromo = number.match(/^(SWSH|SM|XY|BW|DP|HGSS)\s*(\d{1,4})$/i);
    const subset = number.match(/^(TG|GG|RC|SV|SH)\s*(\d{1,4})$/i);
    if (promo) { set = promo[1]; number = promo[2]; }
    else if (olderPromo) { set = PROMO_SERIES[olderPromo[1].toUpperCase()]; number = olderPromo[1] + olderPromo[2]; }
    else if (subset) number = subset[1] + subset[2];
  } else if (input.game === 'mtg') {
    const badge = number.match(/^([CURMSBL])(\s*)(\d{1,5}[A-Z★*]?)$/i);
    const rarity = clean(input.rarity).slice(0, 1).toUpperCase();
    if (badge && (badge[2] || badge[1].toUpperCase() === rarity || /^\d{3,}/.test(badge[3]))) number = badge[3];
  }
  // A model can copy the nearby printed set/language badge into "number".
  const combined = number.match(/^([A-Z][A-Z0-9]{1,6})(?:\s+(?:ENG|EN))?[\s-]+(\d{1,5}[A-Z★*]?)$/i)
    || number.match(/^([A-Z][A-Z0-9]{1,5})\s*(?:ENG|EN)[\s-]*(\d{1,5}[A-Z★*]?)$/i);
  if (combined) { set = combined[1].replace(/^(.{2,})(?:ENG|EN)$/i, '$1'); number = combined[2]; }
  return { set, number: collectorNumber(number), total };
}

export function scannedSetMatches(row, wanted) {
  if (!wanted) return true;
  const target = setKey(wanted);
  return [row.setId, row.setCode, row.setName].map(setKey).filter(Boolean).some(key =>
    key === target || (key.length > 5 && target.length > 5 && (key.includes(target) || target.includes(key))));
}
