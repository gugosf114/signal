export const PAGE_ORDER = Object.freeze(['signal', 'collection', 'dossier']);
export const PAGE_SWIPE_MIN_PX = 72;
export const PAGE_SWIPE_AXIS_RATIO = 1.25;

export const PAGE_SWIPE_IGNORE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'iframe',
  '[contenteditable="true"]',
  '[data-page-swipe-ignore="true"]',
  '.ns-track-outer',
  '.cb-set-strip',
  '.sb-list',
  '.live-scanner',
  '.cl-backdrop',
  '.ac-backdrop',
].join(', ');

export function pageSwipeDirection(deltaX, deltaY, {
  minimum = PAGE_SWIPE_MIN_PX,
  axisRatio = PAGE_SWIPE_AXIS_RATIO,
} = {}) {
  const x = Number(deltaX);
  const y = Number(deltaY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.abs(x) < minimum) return null;
  if (Math.abs(x) <= Math.abs(y) * axisRatio) return null;
  return x < 0 ? 'next' : 'previous';
}

export function pageAfterSwipe(page, direction) {
  const index = PAGE_ORDER.indexOf(page);
  if (index < 0) return page;
  if (direction === 'next') return PAGE_ORDER[Math.min(PAGE_ORDER.length - 1, index + 1)];
  if (direction === 'previous') return PAGE_ORDER[Math.max(0, index - 1)];
  return page;
}
