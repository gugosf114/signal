// Measure only a thin, uniform white margin outside the printed card.
// A wide white card border or a non-white background is left intact.
export function detectCardImagePadding(data, width, height) {
  if (width < 80 || height < 80 || data.length < width * height * 4) return null;
  const white = (x, y) => {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return data[i + 3] >= 250 && Math.min(r, g, b) >= 245 && Math.max(r, g, b) - Math.min(r, g, b) <= 10;
  };
  const whiteLine = (side, offset) => {
    const span = side < 2 ? height : width;
    let light = 0, count = 0;
    const step = Math.max(1, Math.floor(span / 120));
    for (let n = Math.floor(span * .2); n < span * .8; n += step) {
      const x = side === 0 ? offset : side === 1 ? width - 1 - offset : n;
      const y = side === 2 ? offset : side === 3 ? height - 1 - offset : n;
      if (white(x, y)) light++;
      count++;
    }
    return light / count >= .95;
  };
  const margins = [];
  for (let side = 0; side < 4; side++) {
    const limit = Math.max(1, Math.floor((side < 2 ? width : height) * .015));
    let n = 0;
    while (n <= limit && whiteLine(side, n)) n++;
    if (n === 0 || n > limit) return null;
    margins.push(n);
  }
  const [left, right, top, bottom] = margins;
  if (Math.abs(left - right) > Math.max(2, width * .005)
    || Math.abs(top - bottom) > Math.max(2, height * .005)) return null;
  const cropWidth = width - left - right, cropHeight = height - top - bottom;
  // Find the printed round corner just inside the padding. The circle
  // equation converts insets across several rows into each corner radius.
  const radii = [[false, false], [true, false], [true, true], [false, true]].map(([flipX, flipY]) => {
    const estimates = [];
    for (const depth of [0, 1, 2, 3, 4, 6]) {
      const y = flipY ? height - bottom - 1 - depth : top + depth;
      const limit = Math.floor(cropWidth * .09);
      let inset = 0;
      while (inset < limit && white(flipX ? width - right - 1 - inset : left + inset, y)) inset++;
      if (inset >= limit) return null;
      estimates.push(inset ? Math.ceil(inset + depth + Math.sqrt(2 * inset * depth)) + 1 : 0);
    }
    return Math.min(cropWidth * .08, Math.max(...estimates));
  });
  if (radii.some(radius => radius === null)) return null;
  return { left: left / width, right: right / width, top: top / height, bottom: bottom / height,
    ratio: cropWidth / cropHeight,
    radius: `${radii.map(r => `${100 * r / cropWidth}%`).join(' ')} / ${radii.map(r => `${100 * r / cropHeight}%`).join(' ')}` };
}

const measurements = new Map();
function measure(image) {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, 1536 / Math.max(naturalWidth, naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(naturalWidth * scale); canvas.height = Math.round(naturalHeight * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return detectCardImagePadding(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}
export function measureCardImagePadding(image) {
  const url = image.currentSrc || image.src;
  if (measurements.has(url)) return measurements.get(url);
  const promise = (async () => {
    try { return measure(image); } catch {}
    // Native HTTP can read catalogue images whose image element is cross-origin.
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('Image could not be measured');
    const bitmap = await createImageBitmap(await response.blob());
    try { return measure(bitmap); } finally { bitmap.close(); }
  })().catch(() => { measurements.delete(url); return null; });
  if (measurements.size >= 80) measurements.delete(measurements.keys().next().value);
  measurements.set(url, promise);
  return promise;
}
