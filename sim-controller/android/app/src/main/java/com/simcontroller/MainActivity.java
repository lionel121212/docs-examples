package com.simcontroller;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Full-screen landscape shell for the Sim Controller dashboard.
 *
 * The dashboard itself is served by the PC (server.py) and reaches the phone
 * through `adb reverse tcp:8000 tcp:8000`, so the app loads http://localhost:8000.
 * While the PC is not reachable it shows a waiting screen and retries.
 */
public class MainActivity extends Activity {

    private static final String DASHBOARD_URL = "http://localhost:8000/?app=1";
    private static final long RETRY_MS = 2000;

    private WebView web;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean showingWaiting = false;

    private final Runnable retry = () -> {
        if (showingWaiting) {
            web.loadUrl(DASHBOARD_URL);
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#07080D"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "SimNative");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showWaiting();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith("http://localhost")) {
                    showingWaiting = false;
                }
            }
        });

        setContentView(web);
        hideSystemBars();
        web.loadUrl(DASHBOARD_URL);
    }

    private void showWaiting() {
        showingWaiting = true;
        web.loadDataWithBaseURL(null, WAITING_HTML, "text/html", "utf-8", null);
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
        if (showingWaiting) {
            handler.removeCallbacks(retry);
            handler.post(retry);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Ignore back so a stray tap during a race does not close the dashboard.
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(retry);
        web.destroy();
        super.onDestroy();
    }

    /** Called from the dashboard JavaScript as window.SimNative.vibrate(ms). */
    private class Bridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(VibrationEffect.createOneShot(Math.max(5, Math.min(ms, 80)),
                        VibrationEffect.DEFAULT_AMPLITUDE));
            }
        }
    }

    private static final String WAITING_HTML =
            "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
          + "<style>html,body{margin:0;height:100%;background:#07080d;color:#e8ecf3;"
          + "font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center}"
          + ".c{text-align:center}.d{display:flex;gap:10px;justify-content:center;margin-bottom:22px}"
          + ".d i{width:14px;height:14px;border-radius:50%;background:#22d3ee;box-shadow:0 0 12px #22d3ee;"
          + "animation:p 1.2s infinite ease-in-out}.d i:nth-child(2){animation-delay:.2s;background:#a78bfa;box-shadow:0 0 12px #a78bfa}"
          + ".d i:nth-child(3){animation-delay:.4s;background:#f472b6;box-shadow:0 0 12px #f472b6}"
          + "@keyframes p{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}"
          + "h1{font-size:22px;font-weight:600;margin:0 0 6px}p{margin:0;color:#8b96a8;font-size:15px}</style></head>"
          + "<body><div class='c'><div class='d'><i></i><i></i><i></i></div>"
          + "<h1>ממתין למחשב</h1>"
          + "<p dir='rtl'>חבר את הכבל וודא ש-start.bat פועל</p>"
          + "</div></body></html>";
}
