import { Capacitor, registerPlugin } from '@capacitor/core';

const ScannerDisplay = registerPlugin('ScannerDisplay');

export async function setScannerOverlayProtection(hidden) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScannerDisplay.setOverlayProtection({ hidden: Boolean(hidden) });
  } catch (error) {
    console.warn('[signal] scanner overlay protection failed:', error?.message || error);
  }
}
