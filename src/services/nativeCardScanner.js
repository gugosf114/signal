import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeCardScanner = registerPlugin('NativeCardScanner');

export function nativeCardScannerAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativeCardScanner');
}

export function shouldRenderScannerShell({ open, native, phase }) {
  if (!open) return false;
  // The native camera owns the screen while it starts. Rendering the old web
  // camera underneath for this one paint is the visible "two scanners" flash.
  return !(native && phase === 'opening');
}

export async function nativeScannerPagesToFiles(pages, {
  fetcher = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  const files = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (!page?.url) continue;
    const response = await fetcher(page.url);
    if (!response.ok) throw new Error('The scanned card photo could not be opened.');
    const blob = await response.blob();
    files.push(new File(
      [blob],
      `signal-card-${now()}-${index}.jpg`,
      { type: blob.type || 'image/jpeg' },
    ));
  }
  if (!files.length) throw new Error('The card scanner returned no photo.');
  return files;
}

export async function scanCardsNatively({ batch = false, photos = false } = {}) {
  const result = await NativeCardScanner.scan({
    batch: Boolean(batch),
    photos: Boolean(photos),
  });
  if (result?.cancelled) return { cancelled: true, files: [], pages: [] };
  const pages = Array.isArray(result?.pages) ? result.pages : [];
  const files = await nativeScannerPagesToFiles(pages);
  return { cancelled: false, files, pages };
}

export async function deliverNativeScannerResult(result, {
  identify,
  onCancel,
  onPending,
} = {}) {
  if (result?.cancelled) {
    onCancel?.();
    return 'cancelled';
  }
  if (!result?.files?.length) throw new Error('The card scanner returned no photo.');
  if (typeof identify !== 'function') throw new Error('The scanner photo receiver is unavailable.');
  onPending?.(result.files.slice(1));
  await identify(result.files[0], false);
  return 'delivered';
}
