package com.gugosf114.signal;

import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS bridge to start/stop the scan foreground service.
 *
 * The service exists for one reason: to keep a scan's network request alive
 * when the user minimizes the app mid-scan. It is a nicety, not the feature.
 *
 * Android 12+ refuses startForegroundService() when the app is not already in
 * the foreground and throws ForegroundServiceStartNotAllowedException. Capacitor
 * turns any throw out of a @PluginMethod into a FATAL EXCEPTION on the
 * CapacitorPlugins thread, so the whole app died — observed on device: starting
 * a scan while the app was in the background killed the process outright, taking
 * the scan with it. Losing the keep-alive is a small thing; losing the app is
 * not. Failing to start it is now logged and swallowed, and the scan proceeds
 * without it.
 */
@CapacitorPlugin(name = "ScanService")
public class ScanServicePlugin extends Plugin {

    private static final String TAG = "ScanService";

    @PluginMethod
    public void start(PluginCall call) {
        Intent i = new Intent(getContext(), ScanForegroundService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(i);
            } else {
                getContext().startService(i);
            }
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "keep-alive service not started: " + e);
            call.resolve();
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), ScanForegroundService.class));
        } catch (Exception e) {
            Log.w(TAG, "keep-alive service not stopped: " + e);
        }
        call.resolve();
    }
}
