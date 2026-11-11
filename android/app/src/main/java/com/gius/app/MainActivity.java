package com.gius.app;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

// tools/java/MainActivity.java.in — זהות המעטפת: הערכים שנבדלים בין האפליקציות, מהתצורה
public class MainActivity extends ShellActivity {

    @Override
    protected String appUrl() { return "https://ygtotlrl-lab.github.io/gius/"; }

    @Override
    protected String offlineLine() { return "גיוס לא הצליח להתחבר."; }

    @Override
    protected String accentColor() { return "#2b4f8a"; }

    // המקור היחיד שרשאי להגיע לגשר השיתוף — גשר על דף שנטען מרחוק נגיש לכל מי שמגיש את הדף.
    // נאכף פעמיים: רשימת ההיתר של הפלטפורמה ובדיקת המקור בתוך הגשר.
    // origin ולא URL — הנתיב אינו גבול האבטחה.
    private static final String APP_ORIGIN = "https://ygtotlrl-lab.github.io";
    private static final String APP_HOST = "ygtotlrl-lab.github.io";
    private static final Set<String> ALLOWED_ORIGINS = new HashSet<>(Arrays.asList(APP_ORIGIN));

    private boolean legacyBridgeAttached = false;

    // ── גשר שיתוף, מוגבל למקור ──
    // addJavascriptInterface מוזרק לכל frame בכל דף בלי מושג מקור — לכן מועדף addWebMessageListener (WebView 88+), שבודק את רשימת ההיתר פר-frame.
    // במסלול הישן הממשק מחובר רק על המקור שלנו, וכל קריאה בודקת שוב את המארח החי ב-UI thread.
    @Override
    protected void installBridge() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                webView, "AndroidShareBridge", ALLOWED_ORIGINS,
                new WebViewCompat.WebMessageListener() {
                    @Override
                    public void onPostMessage(@NonNull WebView view, @NonNull WebMessageCompat message,
                                              @NonNull Uri sourceOrigin, boolean isMainFrame,
                                              @NonNull JavaScriptReplyProxy replyProxy) {
                        // הגנה כפולה: WebView כבר סינן לפי ALLOWED_ORIGINS.
                        if (!isMainFrame || !APP_ORIGIN.equals(String.valueOf(sourceOrigin))) return;
                        try {
                            JSONObject o = new JSONObject(String.valueOf(message.getData()));
                            shareFile(o.optString("data"), o.optString("mime"), o.optString("name"));
                        } catch (Exception e) {
                            toastUi("שגיאה בהכנת הקובץ לשיתוף");
                        }
                    }
                });
            // כמה קבצים בבורר אחד (דוח שחולק לכמה תמונות) — גשר משלו: הדף מזהה לפי קיומו שהמעטפת יודעת לשלוח כמה, ובמעטפת ישנה — הודעה לעדכן את האפליקציה.
            WebViewCompat.addWebMessageListener(
                webView, "AndroidShareFiles", ALLOWED_ORIGINS,
                new WebViewCompat.WebMessageListener() {
                    @Override
                    public void onPostMessage(@NonNull WebView view, @NonNull WebMessageCompat message,
                                              @NonNull Uri sourceOrigin, boolean isMainFrame,
                                              @NonNull JavaScriptReplyProxy replyProxy) {
                        if (!isMainFrame || !APP_ORIGIN.equals(String.valueOf(sourceOrigin))) return;
                        try {
                            shareFiles(new JSONObject(String.valueOf(message.getData())).getJSONArray("files"));
                        } catch (Exception e) {
                            toastUi("שגיאה בהכנת הקובץ לשיתוף");
                        }
                    }
                });
        }
        // הממשק הישן אינו מחובר כאן — עוד לא נטען דף, וחיבור בלי תנאי הוא בדיוק מה שיש למנוע; הוא מחובר בניווט, כשהמקור ידוע.
    }

    @Override
    protected void onShellNavigation(String url) {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        boolean ours = isAppOrigin(url);
        if (ours && !legacyBridgeAttached) {
            webView.addJavascriptInterface(new ShareBridge(), "AndroidShare");
            legacyBridgeAttached = true;
        } else if (!ours && legacyBridgeAttached) {
            webView.removeJavascriptInterface("AndroidShare");
            legacyBridgeAttached = false;
        }
    }

    // https ובדיוק המארח שלנו — גם http על אותו מארח אינו אנחנו.
    private static boolean isAppOrigin(String url) {
        if (url == null) return false;
        try {
            Uri u = Uri.parse(url);
            return "https".equals(u.getScheme()) && APP_HOST.equals(u.getHost());
        } catch (Exception e) {
            return false;
        }
    }

    // ── השיתוף עצמו ──
    // אין יעד קבוע — הבורר של המערכת בוחר; יעד קבוע היה שולח את הדוח לאפליקציה אחת בלבד.
    // הקובץ — תמונה, PDF או גיליון, והסיומת נגזרת מסוג התוכן: אפליקציה שמקבלת קובץ בסיומת שגויה אינה פותחת אותו.
    // name — שם הקובץ מהדף (גיליון התלמיד והחודש); ריק — הקידומת והשעה. תיקייה לכל שיתוף, כדי ששני קבצים באותו שם לא ידרסו.
    private void shareFile(final String base64Data, final String mimeType, final String name) {
        try {
            final String mime = mimeOf(mimeType);
            File dir = new File(getCacheDir(), "shared");
            shareSaved(writeShared(base64Data, mime, name, dir), mime);
        } catch (Exception e) {
            toastUi("שגיאה בהכנת הקובץ לשיתוף");
        }
    }

    private static String mimeOf(String mimeType) {
        return (mimeType == null || mimeType.isEmpty()) ? "image/jpeg" : mimeType;
    }

    // כתיבת קובץ אחד למטמון «shared», בשם שנגזר מהדף; תיקייה לכל שיתוף, כדי ששני קבצים באותו שם לא ידרסו.
    private File writeShared(String base64Data, String mime, String name, File dir) throws Exception {
        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
        dir.mkdirs();
        final String ext = "application/pdf".equals(mime) ? ".pdf"
            : "image/png".equals(mime) ? ".png"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(mime) ? ".xlsx"
            : "text/csv".equals(mime) ? ".csv"
            : ".jpg";
        String base = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]+", " ").trim();
        if (base.toLowerCase().endsWith(ext)) base = base.substring(0, base.length() - ext.length()).trim();
        if (base.length() > 120) base = base.substring(0, 120).trim();
        final File f;
        if (base.isEmpty()) {
            f = new File(dir, "g_" + System.nanoTime() + ext);
        } else {
            File sub = new File(dir, String.valueOf(System.nanoTime()));
            sub.mkdirs();
            f = new File(sub, base + ext);
        }
        FileOutputStream fos = new FileOutputStream(f);
        fos.write(bytes);
        fos.flush();
        fos.close();
        return f;
    }

    // כמה קבצים — כולם נכתבים, ובורר אחד שולח את כולם (ACTION_SEND_MULTIPLE); הסוג — המשותף לכולם, ואחרת כל סוג.
    private void shareFiles(final JSONArray files) {
        final ArrayList<Uri> uris = new ArrayList<>();
        String common = null;
        try {
            File dir = new File(getCacheDir(), "shared");
            for (int i = 0; i < files.length(); i++) {
                JSONObject o = files.getJSONObject(i);
                String mime = mimeOf(o.optString("mime"));
                common = common == null ? mime : (common.equals(mime) ? common : "*/*");
                File f = writeShared(o.optString("data"), mime, o.optString("name"), dir);
                uris.add(FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", f));
            }
        } catch (Exception e) {
            toastUi("שגיאה בהכנת הקובץ לשיתוף");
            return;
        }
        if (uris.isEmpty()) return;
        final String type = common;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Intent send = new Intent(Intent.ACTION_SEND_MULTIPLE);
                send.setType(type);
                send.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                // ההרשאה לקריאה עוברת לכל הקבצים דרך ClipData — EXTRA_STREAM לבדו אינו מעביר אותה לכולם
                ClipData clip = ClipData.newRawUri("", uris.get(0));
                for (int i = 1; i < uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
                send.setClipData(clip);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivity(Intent.createChooser(send, "undefined"));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "שגיאה בשיתוף", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    // קובץ שכבר נכתב במטמון «shared» — לבורר השיתוף של המערכת.
    private void shareSaved(final File f, final String mime) {
        final Uri uri;
        try {
            uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", f);
        } catch (Exception e) {
            toastUi("שגיאה בהכנת הקובץ לשיתוף");
            return;
        }
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                // createChooser בלי FLAG_ACTIVITY_NEW_TASK — המשתמש בוחר יעד בכל פעם, והחזרה מביאה אותו למעטפת.
                Intent toStart = Intent.createChooser(send, "undefined");
                try {
                    startActivity(toStart);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "שגיאה בשיתוף", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }


    // מתודות JavascriptInterface רצות ב-binder thread פרטי — לכן ה-URL החי נקרא ב-UI thread לפני כל פעולה: זה המנעול השני.
    private class ShareBridge {
        @JavascriptInterface
        public void shareFile(final String base64Data, final String mimeType) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (!isAppOrigin(webView.getUrl())) return;
                    MainActivity.this.shareFile(base64Data, mimeType, "");
                }
            });
        }
    }
}
