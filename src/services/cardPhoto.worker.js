import { detectCardBounds, straightenCard } from './cardPhotoEdges.js';

async function cropPhoto(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const bounds = detectCardBounds(context.getImageData(0, 0, canvas.width, canvas.height));
    if (!bounds) return { cropped: false };
    const workScale = Math.min(1, 3072 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * workScale));
    canvas.height = Math.max(1, Math.round(bitmap.height * workScale));
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const source = context.getImageData(0, 0, canvas.width, canvas.height);
    const multiplier = workScale / scale;
    const outputScale = Math.min(multiplier, 2048 / Math.max(bounds.width, bounds.height));
    const width = Math.max(2, Math.round(bounds.width * outputScale));
    const height = Math.max(2, Math.round(bounds.height * outputScale));
    const corners = bounds.corners.map(p => ({ x: p.x * multiplier, y: p.y * multiplier }));
    const pixels = straightenCard(source, corners, width, height);
    const output = new OffscreenCanvas(width, height);
    output.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
    const blob = await output.convertToBlob({ type: 'image/jpeg', quality: 0.94 });
    return { cropped: true, blob, width, height, corners: bounds.corners.map(p => ({ x: p.x / scale, y: p.y / scale })) };
  } finally { bitmap.close(); }
}

self.onmessage = async ({ data }) => {
  try { self.postMessage(await cropPhoto(data.file)); }
  catch { self.postMessage({ cropped: false }); }
};
