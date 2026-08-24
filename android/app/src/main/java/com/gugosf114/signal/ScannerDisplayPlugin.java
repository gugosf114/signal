package com.gugosf114.signal;

import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Keeps floating bubbles from covering the card frame while the scanner is open. */
@CapacitorPlugin(name = "ScannerDisplay")
public class ScannerDisplayPlugin extends Plugin {
    @PluginMethod
    public void setOverlayProtection(PluginCall call) {
        final boolean hidden = Boolean.TRUE.equals(call.getBoolean("hidden", false));
        getActivity().runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                getActivity().getWindow().setHideOverlayWindows(hidden);
            }
            JSObject result = new JSObject();
            result.put("hidden", hidden);
            call.resolve(result);
        });
    }
}
