// Starts/stops the native foreground service that keeps a scan running while the
// app is backgrounded. No-op on web. Failures are swallowed — keep-alive is a
// best-effort enhancement, never a reason to block a scan.
import { registerPlugin, Capacitor } from '@capacitor/core';

const ScanService = registerPlugin('ScanService');

export async function startScanKeepAlive() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScanService.start();
  } catch (e) {
    // Non-fatal — scan continues, but backgrounding may abort the request on
    // aggressive OEMs (Samsung, Xiaomi). Log so it shows in adb logcat.
    console.warn('[signal] startScanKeepAlive failed (non-fatal):', e?.message ?? e);
  }
}

export async function stopScanKeepAlive() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ScanService.stop();
  } catch (e) {
    console.warn('[signal] stopScanKeepAlive failed (non-fatal):', e?.message ?? e);
  }
}

// Own one uninterrupted foreground-service lease across a multi-step scan.
// Camera scans identify the photo, resolve its catalogue printing, and only
// then enter analyzeCard. Without this wrapper Android can freeze the WebView
// during those first seconds, before SignalDashboard starts its own lease.
export async function withScanKeepAlive(work, controls = {}) {
  const start = controls.start || startScanKeepAlive;
  const stop = controls.stop || stopScanKeepAlive;
  await start();
  try {
    return await work();
  } finally {
    await stop();
  }
}
