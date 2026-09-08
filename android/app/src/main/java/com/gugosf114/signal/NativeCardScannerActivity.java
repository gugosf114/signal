package com.gugosf114.signal;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraInfo;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.view.CameraController;
import androidx.camera.view.LifecycleCameraController;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Signal's native card camera. CameraX supplies the real preview, focus,
 * exposure and full-quality still. Signal owns this window, so Android can
 * keep floating bubbles off the card while the camera is open.
 */
public class NativeCardScannerActivity extends AppCompatActivity {
    public static final String EXTRA_PAGE_LIMIT = "pageLimit";
    public static final String EXTRA_PHOTOS_ONLY = "photosOnly";
    public static final String EXTRA_PATHS = "paths";
    public static final String EXTRA_ERROR = "error";

    private static final int SIGNAL_RED = Color.rgb(196, 64, 64);
    private static final int CREAM = Color.rgb(245, 241, 232);

    private final ExecutorService fileExecutor = Executors.newSingleThreadExecutor();
    private final ArrayList<String> paths = new ArrayList<>();
    private LifecycleCameraController cameraController;
    private TextView statusView;
    private TextView flashButton;
    private TextView doneButton;
    private ShutterView shutterButton;
    private int pageLimit = 1;
    private boolean torchOn;
    private boolean finishingWithResult;
    private boolean photosOnly;
    private int flashChecks;

    private final ActivityResultLauncher<String> cameraPermission = registerForActivityResult(
        new ActivityResultContracts.RequestPermission(),
        granted -> {
            if (granted) startCamera();
            else finishWithError("Allow Camera for Signal, then try again.");
        }
    );

    private final ActivityResultLauncher<String[]> galleryPicker = registerForActivityResult(
        new ActivityResultContracts.OpenMultipleDocuments(),
        this::handleGalleryResult
    );

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setNavigationBarColor(Color.BLACK);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat systemBars = WindowCompat.getInsetsController(
            getWindow(), getWindow().getDecorView()
        );
        systemBars.hide(WindowInsetsCompat.Type.systemBars());
        systemBars.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getWindow().setHideOverlayWindows(true);
        }

        pageLimit = Math.max(1, Math.min(50, getIntent().getIntExtra(EXTRA_PAGE_LIMIT, 1)));
        photosOnly = getIntent().getBooleanExtra(EXTRA_PHOTOS_ONLY, false);
        if (savedInstanceState != null) {
            ArrayList<String> restored = savedInstanceState.getStringArrayList("paths");
            if (restored != null) paths.addAll(restored);
        }
        pruneOldScans();
        buildInterface();
        updateBatchControls();

        if (photosOnly) {
            statusView.setText(R.string.scanner_opening_photos);
            galleryPicker.launch(new String[]{"image/*"});
            return;
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            cameraPermission.launch(Manifest.permission.CAMERA);
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        outState.putStringArrayList("paths", paths);
        super.onSaveInstanceState(outState);
    }

    private void buildInterface() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        PreviewView preview = new PreviewView(this);
        preview.setId(View.generateViewId());
        preview.setImplementationMode(PreviewView.ImplementationMode.PERFORMANCE);
        preview.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        root.addView(preview, matchParent());

        CardFrameView frame = new CardFrameView();
        root.addView(frame, matchParent());

        View topShade = new View(this);
        topShade.setBackground(new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{0xE6000000, 0x90000000, 0x00000000}
        ));
        FrameLayout.LayoutParams topShadeParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, dp(120)
        );
        topShadeParams.gravity = Gravity.TOP;
        root.addView(topShade, topShadeParams);

        View bottomShade = new View(this);
        bottomShade.setBackground(new GradientDrawable(
            GradientDrawable.Orientation.BOTTOM_TOP,
            new int[]{0xFF000000, 0xE6000000, 0x00000000}
        ));
        FrameLayout.LayoutParams bottomShadeParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, dp(190)
        );
        bottomShadeParams.gravity = Gravity.BOTTOM;
        root.addView(bottomShade, bottomShadeParams);

        TextView closeButton = actionButton("×", getString(R.string.scanner_close), 28);
        closeButton.setOnClickListener(view -> cancelScanner());
        FrameLayout.LayoutParams closeParams = squareParams(56);
        closeParams.gravity = Gravity.TOP | Gravity.START;
        closeParams.setMargins(dp(8), dp(8), 0, 0);
        root.addView(closeButton, closeParams);

        flashButton = actionButton(
            getString(R.string.scanner_flash),
            getString(R.string.scanner_turn_flash_on),
            11
        );
        flashButton.setOnClickListener(view -> toggleTorch());
        FrameLayout.LayoutParams flashParams = new FrameLayout.LayoutParams(dp(76), dp(52));
        flashParams.gravity = Gravity.TOP | Gravity.END;
        flashParams.setMargins(0, dp(10), dp(10), 0);
        root.addView(flashButton, flashParams);

        statusView = new TextView(this);
        statusView.setText(R.string.scanner_opening);
        statusView.setTextColor(CREAM);
        statusView.setTextSize(15);
        statusView.setGravity(Gravity.CENTER);
        statusView.setSingleLine(true);
        statusView.setBackground(roundRect(0xB8000000, 22, 0, Color.TRANSPARENT));
        statusView.setPadding(dp(18), 0, dp(18), 0);
        FrameLayout.LayoutParams statusParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, dp(44)
        );
        statusParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        statusParams.topMargin = dp(72);
        root.addView(statusView, statusParams);

        TextView photosButton = actionButton(
            getString(R.string.scanner_photos),
            getString(R.string.scanner_choose_photos),
            11
        );
        photosButton.setBackground(roundRect(0xCC0E1014, 14, 1, 0x663A3D44));
        photosButton.setOnClickListener(view -> galleryPicker.launch(new String[]{"image/*"}));
        FrameLayout.LayoutParams photosParams = new FrameLayout.LayoutParams(dp(92), dp(64));
        photosParams.gravity = Gravity.BOTTOM | Gravity.START;
        photosParams.setMargins(dp(22), 0, 0, dp(34));
        root.addView(photosButton, photosParams);

        shutterButton = new ShutterView();
        shutterButton.setContentDescription(getString(R.string.scanner_scan_card));
        shutterButton.setOnClickListener(view -> captureCard());
        FrameLayout.LayoutParams shutterParams = squareParams(92);
        shutterParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        shutterParams.bottomMargin = dp(22);
        root.addView(shutterButton, shutterParams);

        doneButton = actionButton(
            getString(R.string.scanner_done),
            getString(R.string.scanner_finish_batch),
            11
        );
        doneButton.setBackground(roundRect(0xCC0E1014, 14, 1, 0x99608870));
        doneButton.setTextColor(Color.rgb(196, 216, 200));
        doneButton.setOnClickListener(view -> finishWithPaths());
        FrameLayout.LayoutParams doneParams = new FrameLayout.LayoutParams(dp(92), dp(64));
        doneParams.gravity = Gravity.BOTTOM | Gravity.END;
        doneParams.setMargins(0, 0, dp(22), dp(34));
        root.addView(doneButton, doneParams);

        setContentView(root);

        cameraController = new LifecycleCameraController(this);
        cameraController.setCameraSelector(CameraSelector.DEFAULT_BACK_CAMERA);
        cameraController.setEnabledUseCases(CameraController.IMAGE_CAPTURE);
        cameraController.setImageCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY);
        cameraController.setImageCaptureFlashMode(ImageCapture.FLASH_MODE_OFF);
        cameraController.setImageCaptureIoExecutor(fileExecutor);
        preview.setController(cameraController);
    }

    private void startCamera() {
        try {
            cameraController.bindToLifecycle(this);
            statusView.setText(R.string.scanner_place_card);
            flashButton.setEnabled(false);
            flashButton.setAlpha(0.35f);
            flashChecks = 0;
            flashButton.postDelayed(this::updateFlashAvailability, 250);
        } catch (Exception error) {
            finishWithError(error.getLocalizedMessage() == null
                ? "The camera could not open."
                : error.getLocalizedMessage());
        }
    }

    private void updateFlashAvailability() {
        boolean hasFlash = false;
        try {
            CameraInfo cameraInfo = cameraController.getCameraInfo();
            hasFlash = cameraInfo != null && cameraInfo.hasFlashUnit();
        } catch (Exception ignored) {
            // CameraX can still be finishing its first bind on this frame.
        }
        if (hasFlash) {
            flashButton.setEnabled(true);
            flashButton.setAlpha(1f);
            return;
        }
        flashChecks += 1;
        if (flashChecks < 5) flashButton.postDelayed(this::updateFlashAvailability, 350);
    }

    private void captureCard() {
        if (!shutterButton.isEnabled() || finishingWithResult) return;
        setCaptureEnabled(false);
        statusView.setText(R.string.scanner_hold_still);
        File target = newScanFile(paths.size());
        ImageCapture.OutputFileOptions options = new ImageCapture.OutputFileOptions.Builder(target).build();
        cameraController.takePicture(options, fileExecutor, new ImageCapture.OnImageSavedCallback() {
            @Override
            public void onImageSaved(@NonNull ImageCapture.OutputFileResults result) {
                paths.add(target.getAbsolutePath());
                runOnUiThread(() -> {
                    if (pageLimit == 1 || paths.size() >= pageLimit) {
                        finishWithPaths();
                    } else {
                        updateBatchControls();
                        setCaptureEnabled(true);
                    }
                });
            }

            @Override
            public void onError(@NonNull ImageCaptureException error) {
                target.delete();
                runOnUiThread(() -> {
                    statusView.setText(R.string.scanner_photo_failed);
                    setCaptureEnabled(true);
                });
            }
        });
    }

    private void toggleTorch() {
        if (!flashButton.isEnabled()) return;
        torchOn = !torchOn;
        cameraController.enableTorch(torchOn);
        flashButton.setText(torchOn ? R.string.scanner_flash_on : R.string.scanner_flash);
        flashButton.setContentDescription(getString(
            torchOn ? R.string.scanner_turn_flash_off : R.string.scanner_turn_flash_on
        ));
        flashButton.setTextColor(torchOn ? Color.rgb(255, 229, 160) : CREAM);
    }

    private void handleGalleryResult(List<Uri> selected) {
        if (selected == null || selected.isEmpty()) {
            if (photosOnly) cancelScanner();
            return;
        }
        setCaptureEnabled(false);
        statusView.setText(R.string.scanner_opening_photos);
        fileExecutor.execute(() -> {
            try {
                int room = pageLimit - paths.size();
                for (int index = 0; index < selected.size() && index < room; index++) {
                    paths.add(copyPage(selected.get(index), paths.size()));
                }
                runOnUiThread(() -> {
                    if (pageLimit == 1 || paths.size() >= pageLimit) finishWithPaths();
                    else {
                        updateBatchControls();
                        setCaptureEnabled(true);
                    }
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    statusView.setText(R.string.scanner_photo_open_failed);
                    setCaptureEnabled(true);
                });
            }
        });
    }

    private String copyPage(Uri source, int index) throws IOException {
        File target = newScanFile(index);
        try (
            InputStream input = getContentResolver().openInputStream(source);
            FileOutputStream output = new FileOutputStream(target)
        ) {
            if (input == null) throw new IOException("The selected photo was empty.");
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
        }
        return target.getAbsolutePath();
    }

    private File newScanFile(int index) {
        File scannerDir = new File(getCacheDir(), "card-scanner");
        if (!scannerDir.exists()) scannerDir.mkdirs();
        return new File(
            scannerDir,
            "signal-card-" + System.currentTimeMillis() + "-" + index + "-" + UUID.randomUUID() + ".jpg"
        );
    }

    private void updateBatchControls() {
        boolean batch = pageLimit > 1;
        doneButton.setVisibility(batch ? View.VISIBLE : View.INVISIBLE);
        doneButton.setEnabled(batch && !paths.isEmpty());
        doneButton.setAlpha(paths.isEmpty() ? 0.4f : 1f);
        if (batch && !paths.isEmpty()) {
            int count = paths.size();
            doneButton.setText(getString(R.string.scanner_done_count, count));
            doneButton.setContentDescription(getResources().getQuantityString(
                R.plurals.scanner_finish_batch_count, count, count
            ));
            statusView.setText(getResources().getQuantityString(
                R.plurals.scanner_cards_ready, count, count
            ));
        }
    }

    private void setCaptureEnabled(boolean enabled) {
        shutterButton.setEnabled(enabled);
        shutterButton.setAlpha(enabled ? 1f : 0.45f);
    }

    private void finishWithPaths() {
        if (finishingWithResult || paths.isEmpty()) return;
        finishingWithResult = true;
        if (torchOn) cameraController.enableTorch(false);
        Intent response = new Intent();
        response.putStringArrayListExtra(EXTRA_PATHS, paths);
        setResult(Activity.RESULT_OK, response);
        finish();
    }

    private void cancelScanner() {
        if (torchOn) cameraController.enableTorch(false);
        setResult(Activity.RESULT_CANCELED);
        finish();
    }

    private void finishWithError(String message) {
        Intent response = new Intent();
        response.putExtra(EXTRA_ERROR, message);
        setResult(Activity.RESULT_FIRST_USER, response);
        finish();
    }

    private void pruneOldScans() {
        File scannerDir = new File(getCacheDir(), "card-scanner");
        File[] files = scannerDir.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - (24L * 60L * 60L * 1000L);
        for (File file : files) {
            if (file.isFile() && file.lastModified() < cutoff) file.delete();
        }
    }

    @Override
    protected void onDestroy() {
        if (cameraController != null) cameraController.unbind();
        fileExecutor.shutdownNow();
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void finish() {
        super.finish();
        overridePendingTransition(0, 0);
    }

    private FrameLayout.LayoutParams matchParent() {
        return new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
    }

    private FrameLayout.LayoutParams squareParams(int sizeDp) {
        return new FrameLayout.LayoutParams(dp(sizeDp), dp(sizeDp));
    }

    private TextView actionButton(String text, String description, int textSize) {
        TextView button = new TextView(this);
        button.setText(text);
        button.setContentDescription(description);
        button.setTextColor(CREAM);
        button.setTextSize(textSize);
        button.setGravity(Gravity.CENTER);
        button.setClickable(true);
        button.setFocusable(true);
        button.setBackground(roundRect(0x66000000, 14, 0, Color.TRANSPARENT));
        return button;
    }

    private GradientDrawable roundRect(int color, int radiusDp, int strokeDp, int strokeColor) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        if (strokeDp > 0) drawable.setStroke(dp(strokeDp), strokeColor);
        return drawable;
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private final class ShutterView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        ShutterView() {
            super(NativeCardScannerActivity.this);
            setClickable(true);
            setFocusable(true);
        }

        @Override
        protected void onDraw(@NonNull Canvas canvas) {
            super.onDraw(canvas);
            float cx = getWidth() / 2f;
            float cy = getHeight() / 2f;
            float outer = Math.min(getWidth(), getHeight()) * 0.47f;
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(4));
            paint.setColor(CREAM);
            canvas.drawCircle(cx, cy, outer - dp(3), paint);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(SIGNAL_RED);
            canvas.drawCircle(cx, cy, outer - dp(10), paint);
        }
    }

    private final class CardFrameView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path shade = new Path();
        private final RectF card = new RectF();

        CardFrameView() {
            super(NativeCardScannerActivity.this);
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        }

        @Override
        protected void onDraw(@NonNull Canvas canvas) {
            super.onDraw(canvas);
            float topRoom = dp(118);
            float bottomRoom = dp(170);
            float availableHeight = Math.max(dp(320), getHeight() - topRoom - bottomRoom);
            float frameWidth = Math.min(getWidth() * 0.82f, availableHeight * 0.716f);
            float frameHeight = frameWidth / 0.716f;
            float left = (getWidth() - frameWidth) / 2f;
            float top = topRoom + (availableHeight - frameHeight) / 2f;
            card.set(left, top, left + frameWidth, top + frameHeight);

            shade.reset();
            shade.setFillType(Path.FillType.EVEN_ODD);
            shade.addRect(0, 0, getWidth(), getHeight(), Path.Direction.CW);
            shade.addRoundRect(card, dp(12), dp(12), Path.Direction.CW);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(0x70000000);
            canvas.drawPath(shade, paint);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(2));
            paint.setColor(0xFFF5F1E8);
            canvas.drawRoundRect(card, dp(12), dp(12), paint);
        }
    }
}
