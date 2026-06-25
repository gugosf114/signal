// Starts/stops the native foreground service that keeps a scan running while the
// app is backgrounded. No-op on web. Failures are swallowed — keep-alive is a
// best-effort enhancement, never a reason to block a scan.
import { registerPlugin, Capacitor } from '@capacitor/core';

const ScanService = registerPlugin('ScanService');

export async function startScanKeepAlive() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScanService.start();
  } catch {}
}

export async function stopScanKeepAlive() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScanService.stop();
  } catch {}
}
