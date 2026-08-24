import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const SCAN_ART_DIR = 'signal-scan-art';
const MAX_EDGE = 900;

export function scannedCardImagePath(pin) {
  const identity = pin?.printingId || pin?.id || '';
  const safe = String(identity)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return safe ? `${SCAN_ART_DIR}/${safe}.jpg` : null;
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch {}
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The scanned card photo could not be saved.')); };
    image.src = url;
  });
}

async function resizedJpegBase64(file) {
  const image = await decode(file);
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  if (!width || !height) throw new Error('The scanned card photo could not be read.');
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  return canvas.toDataURL('image/jpeg', 0.82).split(',', 2)[1];
}

export async function saveScannedCardImage(file, pin) {
  if (!file || !Capacitor.isNativePlatform()) return null;
  const path = scannedCardImagePath(pin);
  if (!path) return null;
  const data = await resizedJpegBase64(file);
  await Filesystem.mkdir({ path: SCAN_ART_DIR, directory: Directory.Data, recursive: true }).catch(() => {});
  await Filesystem.writeFile({ path, data, directory: Directory.Data });
  return path;
}

export async function loadScannedCardImage(path) {
  if (!path || !Capacitor.isNativePlatform()) return null;
  try {
    const result = await Filesystem.getUri({ path, directory: Directory.Data });
    return Capacitor.convertFileSrc(result.uri);
  } catch {
    return null;
  }
}
