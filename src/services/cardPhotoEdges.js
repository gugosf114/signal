import { cardShape, chooseCardBounds } from './cardPhotoGeometry.js';

const ANGLES = 90;
const radians = index => index * Math.PI / ANGLES;
const angleGap = (a, b) => Math.min(Math.abs(a - b), ANGLES - Math.abs(a - b));

// Blur cloth/foil texture, then find four long, supported edges. Everything
// runs on a small image in a worker, without a model or a network request.
export function detectCardBounds({ data, width, height }) {
  const size = width * height;
  const gray = new Float32Array(size), horizontal = new Float32Array(size), smooth = new Float32Array(size);
  for (let i = 0; i < size; i++) gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  const weights = [1, 4, 6, 4, 1];
  for (let y = 0; y < height; y++) for (let x = 2; x < width - 2; x++) {
    const i = y * width + x;
    for (let k = -2; k <= 2; k++) horizontal[i] += gray[i + k] * weights[k + 2] / 16;
  }
  for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
    const i = y * width + x;
    for (let k = -2; k <= 2; k++) smooth[i] += horizontal[i + k * width] * weights[k + 2] / 16;
  }
  const magnitude = new Float32Array(size), direction = new Uint8Array(size);
  const diagonal = Math.ceil(Math.hypot(width, height)), bins = diagonal * 2 + 1;
  const votes = new Float32Array(ANGLES * bins);
  const cos = Array.from({ length: ANGLES }, (_, a) => Math.cos(radians(a)));
  const sin = Array.from({ length: ANGLES }, (_, a) => Math.sin(radians(a)));
  for (let y = 4; y < height - 4; y++) for (let x = 4; x < width - 4; x++) {
    const i = y * width + x;
    const gx = smooth[i - width + 1] + 2 * smooth[i + 1] + smooth[i + width + 1]
      - smooth[i - width - 1] - 2 * smooth[i - 1] - smooth[i + width - 1];
    const gy = smooth[i + width - 1] + 2 * smooth[i + width] + smooth[i + width + 1]
      - smooth[i - width - 1] - 2 * smooth[i - width] - smooth[i - width + 1];
    const strength = Math.hypot(gx, gy);
    magnitude[i] = strength;
    if (strength < 24) continue;
    const angle = (Math.round(Math.atan2(gy, gx) * ANGLES / Math.PI) + ANGLES) % ANGLES;
    direction[i] = angle;
    for (let delta = -3; delta <= 3; delta++) {
      const a = (angle + delta + ANGLES) % ANGLES;
      const rho = Math.round(x * cos[a] + y * sin[a]) + diagonal;
      votes[a * bins + rho] += Math.min(strength, 100) / 100;
    }
  }
  const lines = [];
  for (let n = 0; n < 48; n++) {
    let best = -1, score = Math.min(width, height) * 0.13;
    for (let i = 0; i < votes.length; i++) if (votes[i] > score) { best = i; score = votes[i]; }
    if (best < 0) break;
    const a = Math.floor(best / bins), rhoIndex = best % bins;
    lines.push({ angle: a, rho: rhoIndex - diagonal, cos: cos[a], sin: sin[a] });
    for (let delta = -2; delta <= 2; delta++) {
      const rawAngle = a + delta, angle = (rawAngle + ANGLES) % ANGLES;
      const center = rawAngle < 0 || rawAngle >= ANGLES ? bins - 1 - rhoIndex : rhoIndex;
      for (let r = Math.max(0, center - 5); r <= Math.min(bins - 1, center + 5); r++) votes[angle * bins + r] = 0;
    }
  }
  const pairs = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    if (angleGap(lines[i].angle, lines[j].angle) <= 2) pairs.push([lines[i], lines[j]]);
  }
  function intersect(a, b) {
    const determinant = a.cos * b.sin - b.cos * a.sin;
    if (Math.abs(determinant) < 0.5) return { x: NaN, y: NaN };
    return { x: (a.rho * b.sin - b.rho * a.sin) / determinant, y: (a.cos * b.rho - b.cos * a.rho) / determinant };
  }
  function edgeSupport(a, b) {
    const steps = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y)));
    const normal = (Math.round((Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2) * ANGLES / Math.PI) + ANGLES * 2) % ANGLES;
    let found = 0, gap = 0, longestGap = 0;
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(a.x + (b.x - a.x) * k / steps), y = Math.round(a.y + (b.y - a.y) * k / steps);
      let supported = false;
      for (let dy = -2; dy <= 2 && !supported; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        const i = (y + dy) * width + x + dx;
        if (magnitude[i] >= 24 && angleGap(normal, direction[i]) <= 4) { supported = true; break; }
      }
      if (supported) { found++; gap = 0; } else { gap++; longestGap = Math.max(longestGap, gap); }
    }
    return found / (steps + 1) >= 0.90 && longestGap / (steps + 1) < 0.08;
  }
  const candidates = [];
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    const [a, b] = pairs[i], [c, d] = pairs[j];
    if (angleGap(a.angle, c.angle) < 38) continue;
    const corners = [intersect(a, c), intersect(a, d), intersect(b, d), intersect(b, c)];
    const shape = cardShape(corners, width, height);
    if (!shape || !shape.corners.every((p, n) => edgeSupport(p, shape.corners[(n + 1) % 4]))) continue;
    candidates.push(corners);
  }
  return chooseCardBounds(candidates, width, height);
}

// Inverse projective mapping: copy the original pixels into a rectangle.
// The chosen corners already include a margin around printed card numbers.
export function straightenCard(source, corners, width, height) {
  const [p0, p1, p2, p3] = corners;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(determinant) < 1e-6 ? 0 : (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = Math.abs(determinant) < 1e-6 ? 0 : (dx1 * dy3 - dx3 * dy1) / determinant;
  const ax = p1.x - p0.x + g * p1.x, bx = p3.x - p0.x + h * p3.x;
  const ay = p1.y - p0.y + g * p1.y, by = p3.y - p0.y + h * p3.y;
  const output = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1), divisor = g * u + h * v + 1;
      const sx = Math.max(0, Math.min(source.width - 1.001, (ax * u + bx * v + p0.x) / divisor));
      const sy = Math.max(0, Math.min(source.height - 1.001, (ay * u + by * v + p0.y) / divisor));
      const left = Math.floor(sx), top = Math.floor(sy), fx = sx - left, fy = sy - top;
      const i = (top * source.width + left) * 4, out = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const above = source.data[i + channel] * (1 - fx) + source.data[i + 4 + channel] * fx;
        const below = source.data[i + source.width * 4 + channel] * (1 - fx) + source.data[i + source.width * 4 + 4 + channel] * fx;
        output[out + channel] = above * (1 - fy) + below * fy;
      }
      output[out + 3] = 255;
    }
  }
  return output;
}
