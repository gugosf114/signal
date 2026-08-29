import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { cropUploadedCardFile } from './uploadedCardCrop.js';

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

export async function saveScannedCardImage(file, pin, { autoCrop = false } = {}) {
  if (!file || !Capacitor.isNativePlatform()) return null;
  const path = scannedCardImagePath(pin);
  if (!path) return null;
  const source = autoCrop ? await cropUploadedCardFile(file) : file;
  const data = await resizedJpegBase64(source);
  await Filesystem.mkdir({ path: SCAN_ART_DIR, directory: Directory.Data, recursive: true }).catch(() => {});
  await Filesystem.writeFile({ path, data, directory: Directory.Data });
  return path;
}

export async function scannedCardImageExists(path) {
  if (!path || !Capacitor.isNativePlatform()) return false;
  try {
    await Filesystem.stat({ path, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

function base64File(data, name = 'saved-card.jpg') {
  if (data instanceof Blob) return new File([data], name, { type: data.type || 'image/jpeg' });
  const binary = atob(String(data || '').replace(/^data:[^,]+,/, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], name, { type: 'image/jpeg' });
}

export async function cropStoredScannedCardImage(path, pin) {
  if (!path || !pin || !Capacitor.isNativePlatform()) return null;
  const result = await Filesystem.readFile({ path, directory: Directory.Data });
  return saveScannedCardImage(base64File(result.data), pin, { autoCrop: true });
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
