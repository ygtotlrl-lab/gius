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

נוצרים אוטומטית ע"י `node tools/gen-icons.mjs` בשורש הריפו — אותו סקריפט
שמייצר את אייקוני ה-PWA, מאותה מתמטיקת פיקסלים. **לא לערוך ידנית** את
`res/mipmap-*/`. הרקע של ה-adaptive icon הוא `res/drawable/ic_launcher_background.xml`
(טורקיז המותג `#0F766E`).

## בנייה

### הדרך המומלצת — GitHub Actions (לא צריך שום דבר מותקן)

`.github/workflows/build-apk.yml`: Actions → **Build APK** → **Run workflow**.
ה-APK **החתום** יורד כ-artifact בשם `gius-apk`.

החתימה נעשית ב-`signing/sign-apk.sh` מול `signing/gius.keystore` שבריפו —
**אין secret ואין קלט ידני**, ולכן אין דרך לבנות בטעות APK במפתח אחר. הסקריפט
מסרב לחתום אם טביעת האצבע של ה-keystore אינה `92:33:21:96:...:81:7D`, ואחרי
החתימה מוודא שה-APK אכן נושא את התעודה הזו — ה-workflow נכשל בכל אחד מהמקרים.

> ⚠️ **המפתח הוחלף ב-2026-08-19 (סבב 39).** APK חדש ⛔ אינו מתקין על גבי התקנה
> שנחתמה במפתח הישן — נדרשת הסרה והתקנה מחדש, פעם אחת. ר' CLAUDE.md.

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
../signing/sign-apk.sh app/build/outputs/apk/release/app-release-unsigned.apk gius.apk
```

הסקריפט מריץ `zipalign` ואז `apksigner` מול `signing/gius.keystore`
(alias `gius`), ואוכף את טביעת האצבע לפני ואחרי החתימה.

> **ה-keystore נמצא בריפו** — `signing/gius.keystore`, בדיוק כמו
> `signing/yoman.keystore` ב-yoman-avoda. ⛔ זהו קובץ ה-keystore **היחיד**
> ב-`signing/` מסבב 39; שני הקבצים הקודמים נמחקו.
