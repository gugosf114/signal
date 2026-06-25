package com.gugosf114.signal;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScanServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
