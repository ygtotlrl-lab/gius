# gius — מעטפת APK מסוג WebView

מעטפת אנדרואיד מקורית מבוססת **WebView** — **לא TWA**. היא טוענת את האתר החי:

```
https://ygtotlrl-lab.github.io/gius/
```

## למה WebView ולא TWA

ה-APK הקודם נבנה ב-PWABuilder כ-**TWA** (Trusted Web Activity). TWA אינו דפדפן
בפני עצמו — הוא מריץ את האתר **בתוך כרום**, ומשתמש רק בממשק ללא שורת כתובת.
לכן **סינון התוכן שמותקן במכשירים של המשתמשים חוסם אותו**: הסינון חוסם את כרום,
וה-TWA נופל יחד איתו.

WebView הוא רכיב רינדור בתוך התהליך של האפליקציה עצמה, ואינו עובר דרך כרום —
ולכן הסינון לא נוגע בו. זה בדיוק ההבדל בין `yoman-avoda` ו-`hanhala` (שתיהן
WebView ועובדות) לבין gius (TWA, נחסמה).

**אין להחזיר את המעטפת ל-TWA ואין לבנות מחדש ב-PWABuilder** — זה יחזיר את התקלה.

## מה בפנים

| | |
|---|---|
| **Package ID** | `com.gius.app` — זהה ל-TWA שהוא מחליף (חובה, אחרת זו אפליקציה נפרדת) |
| **שם** | גיוס |
| **טוען** | `https://ygtotlrl-lab.github.io/gius/` — מהרשת, לא מנכסים מוטבעים |
| **versionCode** | 2 (ה-TWA היה 1; חייב להיות גבוה יותר כדי להתקין מעליו) |
| **minSdk / targetSdk** | 21 / 34 |
| **WebView** | JavaScript, DOM storage (localStorage — שם יושב ה-session), DB |
| **קישורי `tel:`** | נמסרים למערכת (חיוג לתורם). כל `http`/`https` נשאר בתוך המעטפת |
| **בורר קבצים** | `WebChromeClient.onShowFileChooser` מחובר ל-`<input type=file>` |
| **אופליין** | ה-service worker של האתר. המעטפת מציגה דף שגיאה בעברית רק בהפעלה ראשונה בלי רשת |

**הבדל מכוון מ-yoman-avoda:** אין כאן `addJavascriptInterface`. ב-yoman יש גשר
`AndroidShare` כי היא משתפת תמונות דוח לוואטסאפ; ב-gius אין פיצ'ר כזה, ולדף
שנטען מהרשת לא נותנים גשר מקורי בלי צורך.

**עדכוני קוד web לא מצריכים APK חדש.** האפליקציה טוענת את האתר, ולכן כל דחיפה
ל-`main` מגיעה למכשירים דרך אותו מנגנון service worker + באנר "גרסה חדשה זמינה"
שכבר עובד בדפדפן. APK חדש נדרש רק כששינוי נוגע במעטפת עצמה (הקובץ הזה).

## אייקונים

נוצרים אוטומטית ע"י `node scripts/gen-icons.mjs` בשורש הריפו — אותו סקריפט
שמייצר את אייקוני ה-PWA, מאותה מתמטיקת פיקסלים. **לא לערוך ידנית** את
`res/mipmap-*/`. הרקע של ה-adaptive icon הוא `res/drawable/ic_launcher_background.xml`
(טורקיז המותג `#0F766E`).

## בנייה

### הדרך המומלצת — GitHub Actions (לא צריך שום דבר מותקן)

`.github/workflows/build-apk.yml`: Actions → **Build APK** → **Run workflow**.
ה-APK יורד כ-artifact בשם `gius-apk`.

כדי שה-workflow גם **יחתום**, יש להגדיר secret בשם `GIUS_KEYSTORE_B64` עם
ה-keystore של PWABuilder בקידוד base64:

```bash
base64 -w0 <pwabuilder-keystore>   # להדביק בתור הערך של ה-secret
```

בלי ה-secret ה-workflow עדיין רץ ומעלה APK **לא חתום** (לא ניתן להתקנה).
ה-workflow מאמת שטביעת האצבע יוצאת בדיוק `DA:61:B1:4D:...:FC:4C` ונכשל אם לא.

### בנייה מקומית (דורשת Android SDK)

```bash
cd android
gradle wrapper --gradle-version 8.7   # פעם אחת
./gradlew :app:assembleRelease
# פלט לא חתום:
#   android/app/build/outputs/apk/release/app-release-unsigned.apk
```

חתימה במפתח הקבוע (ר' CLAUDE.md — **אין להחליף מפתח**):

```bash
zipalign -p -f 4 app-release-unsigned.apk aligned.apk
apksigner sign --ks <pwabuilder-keystore> --ks-key-alias my-key-alias \
  --ks-pass pass:uqNfubfXeOyp --key-pass pass:uqNfubfXeOyp \
  --out gius.apk aligned.apk
apksigner verify --print-certs gius.apk
# SHA-256 חייב להיות DA:61:B1:4D:3E:46:B7:AE:82:8C:E6:D0:77:4A:6E:43:4D:1F:F6:E0:91:B7:0C:7C:EF:29:2D:02:A1:31:FC:4C
```

> **ה-keystore של PWABuilder אינו בריפו** (ר' CLAUDE.md). הוא הגיע בחבילת ההורדה
> של ה-APK יחד עם `signing-key-info.txt`. אם הוא אבד — אין דרך לשחזר אותו, וכל
> המשתמשים יצטרכו להסיר את האפליקציה ולהתקין מחדש; במקרה כזה אפשר לעבור לחתימה
> ב-`signing/gius.keystore` שבריפו, אבל זו החלטה שמחייבת הסרה חד-פעמית אצל כולם.
