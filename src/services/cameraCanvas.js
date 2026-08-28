export function drawCameraFrame(video, canvas) {
  const width = Number(video?.videoWidth || video?.width);
  const height = Number(video?.videoHeight || video?.height);
  if (!canvas || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  const context = canvas.getContext?.('2d', { alpha: false });
  if (!context) return false;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  context.drawImage(video, 0, 0, width, height);
  return true;
}
