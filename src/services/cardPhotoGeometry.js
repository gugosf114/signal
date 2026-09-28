// All coordinates are in the small detection image. Reject doubtful shapes;
// keeping the original photo is safer than clipping a printed card number.
export function polygonArea(points) {
  return Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + p.x * next.y - next.x * p.y;
  }, 0)) / 2;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function orderCardCorners(points) {
  if (points?.length !== 4 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const center = points.reduce((c, p) => ({ x: c.x + p.x / 4, y: c.y + p.y / 4 }), { x: 0, y: 0 });
  const ordered = [...points].sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x)
    - Math.atan2(b.y - center.y, b.x - center.x));
  const start = ordered.reduce((best, p, i) => p.x + p.y < ordered[best].x + ordered[best].y ? i : best, 0);
  return [...ordered.slice(start), ...ordered.slice(0, start)];
}

export function cardShape(points, width, height) {
  const corners = orderCardCorners(points);
  if (!corners || width < 1 || height < 1) return null;
  // Touching the photo edge means the actual card edge may be outside it.
  const margin = Math.max(3, Math.min(width, height) * 0.008);
  if (corners.some(p => p.x < margin || p.y < margin || p.x > width - margin || p.y > height - margin)) return null;
  const area = polygonArea(corners);
  const coverage = area / (width * height);
  if (coverage < 0.16 || coverage > 0.94) return null;
  const sides = corners.map((p, i) => distance(p, corners[(i + 1) % 4]));
  if (Math.min(...sides) < Math.min(width, height) * 0.22) return null;
  if (Math.max(sides[0], sides[2]) / Math.min(sides[0], sides[2]) > 1.5
    || Math.max(sides[1], sides[3]) / Math.min(sides[1], sides[3]) > 1.5) return null;
  const across = (sides[0] + sides[2]) / 2;
  const down = (sides[1] + sides[3]) / 2;
  const ratio = Math.min(across, down) / Math.max(across, down);
  if (ratio < 0.60 || ratio > 0.82) return null;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p = corners[i], a = corners[(i + 3) % 4], b = corners[(i + 1) % 4];
    const ax = a.x - p.x, ay = a.y - p.y, bx = b.x - p.x, by = b.y - p.y;
    const cosine = Math.abs((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)));
    const cross = Math.sign(ax * by - ay * bx);
    if (cosine > 0.45 || (sign && cross !== sign)) return null;
    sign = cross;
  }
  return { corners, area, width: across, height: down, ratio };
}

function contains(outer, point) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = outer[i], b = outer[(i + 1) % 4];
    const cross = Math.sign((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x));
    if (cross && sign && cross !== sign) return false;
    if (cross) sign = cross;
  }
  return true;
}

export function chooseCardBounds(candidates, width, height) {
  const shapes = candidates.map(p => cardShape(p, width, height)).filter(Boolean).sort((a, b) => b.area - a.area);
  const best = shapes[0];
  if (!best) return null;
  const center = shape => shape.corners.reduce((c, p) => ({ x: c.x + p.x / 4, y: c.y + p.y / 4 }), { x: 0, y: 0 });
  // Nested outlines are the border/sleeve. Separate or conflicting outlines
  // could be two cards or a textured background: do not choose for the user.
  if (shapes.slice(1).some(shape => shape.area > best.area * 0.45
    && (!contains(best.corners, center(shape)) || distance(center(best), center(shape)) > Math.sqrt(best.area) * 0.28))) return null;
  const c = center(best);
  const corners = best.corners.map(p => ({ x: c.x + (p.x - c.x) * 1.08, y: c.y + (p.y - c.y) * 1.08 }));
  if (corners.some(p => p.x < 0 || p.y < 0 || p.x >= width || p.y >= height)) return null;
  return { ...best, corners, width: best.width * 1.08, height: best.height * 1.08 };
}
