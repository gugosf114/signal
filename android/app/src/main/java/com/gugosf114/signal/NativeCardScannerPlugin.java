package com.gugosf114.signal;

import android.app.Activity;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.FileUtils;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.ArrayList;

/** Makes ML Kit's high-resolution card scan available to the React app. */
@CapacitorPlugin(name = "NativeCardScanner")
public class NativeCardScannerPlugin extends Plugin {
    @PluginMethod
    public void scan(PluginCall call) {
        int pageLimit = Boolean.TRUE.equals(call.getBoolean("batch", false)) ? 50 : 1;
        Intent intent = new Intent(getContext(), NativeCardScannerActivity.class);
        intent.putExtra(NativeCardScannerActivity.EXTRA_PAGE_LIMIT, pageLimit);
        intent.putExtra(
            NativeCardScannerActivity.EXTRA_PHOTOS_ONLY,
            Boolean.TRUE.equals(call.getBoolean("photos", false))
        );
        setOverlayProtection(true);
        startActivityForResult(call, intent, "scanResult");
        suppressLaunchAnimation();
    }

    @ActivityCallback
    private void scanResult(PluginCall call, ActivityResult result) {
        setOverlayProtection(false);
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            response.put("pages", new JSArray());
            call.resolve(response);
            return;
        }
        Intent data = result.getData();
        String error = data == null ? null : data.getStringExtra(NativeCardScannerActivity.EXTRA_ERROR);
        if (result.getResultCode() != Activity.RESULT_OK || error != null) {
            call.reject(error == null ? "The card scanner did not return a photo." : error);
            return;
        }
        ArrayList<String> paths = data.getStringArrayListExtra(NativeCardScannerActivity.EXTRA_PATHS);
        if (paths == null || paths.isEmpty()) {
            call.reject("The card scanner returned no photo.");
            return;
        }
        JSArray pages = new JSArray();
        for (String path : paths) {
            File file = new File(path);
            if (!file.isFile() || !file.canRead()) continue;
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(path, bounds);
            JSObject page = new JSObject();
            page.put("url", FileUtils.getPortablePath(
                getContext(), bridge.getLocalUrl(), Uri.fromFile(file)
            ));
            page.put("width", bounds.outWidth);
            page.put("height", bounds.outHeight);
            page.put("bytes", file.length());
            pages.put(page);
        }
        if (pages.length() == 0) {
            call.reject("The scanned card photo could not be read.");
            return;
        }
        JSObject response = new JSObject();
        response.put("cancelled", false);
        response.put("pages", pages);
        call.resolve(response);
    }

    private void setOverlayProtection(boolean hidden) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getActivity() == null) return;
        getActivity().runOnUiThread(() -> getActivity().getWindow().setHideOverlayWindows(hidden));
    }

    @SuppressWarnings("deprecation")
    private void suppressLaunchAnimation() {
        // A camera is a direct tool, not a second page. The default Android
        // slide made the one native scanner look like another layer opening.
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> getActivity().overridePendingTransition(0, 0));
        }
    }
}
