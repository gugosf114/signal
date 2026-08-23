// Convert a card frame drawn over an object-fit:cover video back into camera pixels.
export function computeVideoCrop(videoWidth, videoHeight, viewWidth, viewHeight, frame) {
  if (![videoWidth, videoHeight, viewWidth, viewHeight, frame?.width, frame?.height].every((value) => Number(value) > 0)) return null;
  const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight);
  const shownWidth = videoWidth * scale;
  const shownHeight = videoHeight * scale;
  const hiddenX = (shownWidth - viewWidth) / 2;
  const hiddenY = (shownHeight - viewHeight) / 2;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const x = clamp((frame.x + hiddenX) / scale, 0, videoWidth);
  const y = clamp((frame.y + hiddenY) / scale, 0, videoHeight);
  const width = clamp(frame.width / scale, 1, videoWidth - x);
  const height = clamp(frame.height / scale, 1, videoHeight - y);
  return { x, y, width, height };
}
