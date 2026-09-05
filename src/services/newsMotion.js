function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

export function centeredNewsIndex(position, viewportWidth, articleCount, cardWidth = 178, gap = 14) {
  const count = Math.max(0, Math.floor(Number(articleCount) || 0));
  if (!count) return 0;
  const width = Math.max(1, Number(cardWidth) || 178);
  const step = width + Math.max(0, Number(gap) || 0);
  const center = (Number(position) || 0) + Math.max(1, Number(viewportWidth) || width) / 2;
  const rawIndex = Math.round((center - width / 2) / step);
  return positiveModulo(rawIndex, count);
}

export function centeredNewsPosition(index, viewportWidth, articleCount, cardWidth = 178, gap = 14) {
  const count = Math.max(0, Math.floor(Number(articleCount) || 0));
  if (!count) return 0;
  const width = Math.max(1, Number(cardWidth) || 178);
  const step = width + Math.max(0, Number(gap) || 0);
  const total = count * step;
  const safeIndex = positiveModulo(Math.floor(Number(index) || 0), count);
  const sideSpace = Math.max(0, (Math.max(1, Number(viewportWidth) || width) - width) / 2);
  return positiveModulo(safeIndex * step - sideSpace, total);
}
