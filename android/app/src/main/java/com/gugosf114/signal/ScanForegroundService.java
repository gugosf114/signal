package com.gugosf114.signal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Keeps a card scan alive while the app is backgrounded. Android (Samsung
 * especially) freezes a normal backgrounded app within seconds, which kills the
 * in-flight network request ("Software caused connection abort"). A foreground
 * service is the one thing the OS won't freeze, so the scan completes even if the
 * user minimizes the app. Started when a scan begins, stopped when it ends.
 */
public class ScanForegroundService extends Service {
    private static final String CHANNEL_ID = "signal_scan";
    private static final int NOTIF_ID = 4711;
    private static final long MAX_RUNTIME_MS = 3 * 60 * 1000L;
    private PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable stopAfterCap = this::stopSelf;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Signal")
                .setContentText("Analyzing card — you can switch away")
                .setSmallIcon(R.drawable.ic_stat_signal)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (Exception e) {
            android.util.Log.e("ScanForegroundService",
                    "startForeground failed; stopping service: " + e.getClass().getSimpleName(), e);
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        try {
            releaseWakeLock();
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "signal:scan");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(MAX_RUNTIME_MS);
        } catch (Exception ignored) {}

        handler.removeCallbacks(stopAfterCap);
        handler.postDelayed(stopAfterCap, MAX_RUNTIME_MS);

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(stopAfterCap);
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {
        } finally {
            wakeLock = null;
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "Card scans", NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }
}
