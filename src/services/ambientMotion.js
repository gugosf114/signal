function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function ambientTiltOffset(beta, gamma, originBeta = 45, originGamma = 0) {
  const safeBeta = beta != null && Number.isFinite(Number(beta)) ? Number(beta) : 45;
  const safeGamma = gamma != null && Number.isFinite(Number(gamma)) ? Number(gamma) : 0;
  const baseBeta = Number.isFinite(Number(originBeta)) ? Number(originBeta) : 45;
  const baseGamma = Number.isFinite(Number(originGamma)) ? Number(originGamma) : 0;
  return {
    x: clamp(safeGamma - baseGamma, -32, 32) / 32 * 28,
    y: clamp(safeBeta - baseBeta, -35, 35) / 35 * 20,
  };
}

export function ambientPointerOffset(clientX, clientY, width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  return {
    x: clamp((Number(clientX) || 0) / safeWidth - 0.5, -0.5, 0.5) * 36,
    y: clamp((Number(clientY) || 0) / safeHeight - 0.5, -0.5, 0.5) * 24,
  };
}
