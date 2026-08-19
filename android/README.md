# gius — Native WebView APK

מעטפת אנדרואיד מקורית מבוססת **WebView** — **לא TWA**. היא טוענת את האתר החי:

```
https://ygtotlrl-lab.github.io/gius/
```

## Why WebView and never a TWA

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

**עדכוני קוד web לא מצריכים APK חדש.** האפליקציה טוענת את האתר, ולכן כל דחיפה
ל-`main` מגיעה למכשירים דרך אותו מנגנון service worker + באנר "גרסה חדשה זמינה"
שכבר עובד בדפדפן. APK חדש נדרש רק כששינוי נוגע במעטפת עצמה (הקובץ הזה).

## ⛔ אין גשר שיתוף — וזה ההבדל היחיד מהתבנית של יומן

למעטפת של yoman-avoda יש `AndroidShareBridge` (מוגבל-origin, בשני מנעולים) כי הדף
שלה קורא ל-`navigator.share` עם תמונת דו"ח. **בקוד של gius אין `navigator.share`
בכלל**, ולכן הגשר הושמט כליל — לא בצד Java, לא בצד הדף, לא ב-manifest ולא
בתלויות.

גשר מקורי על דף שנטען מהרשת הוא כוח שנמסר למי שמגיש את הדף. אם אי-פעם יידרש כאן
גשר — מעתיקים את הדפוס הכפול-נעילה של יומן (`WebViewCompat.addWebMessageListener`
עם `ALLOWED_ORIGINS`, ונפילה-חזרה שמחוברת רק על ה-origin שלנו). **לעולם לא
`addJavascriptInterface` חשוף.**

## למה אין נכסים מוטבעים

- ⛔ **`file://` הוא origin אחסון אחר.** ה-localStorage של `file://` ושל
  `https://ygtotlrl-lab.github.io` הן שתי מחיצות נפרדות לחלוטין. תנועה שנרשמה
  לעותק מוטבע בעלייה ראשונה **לא נראית לאפליקציה האמיתית לעולם** — והיא גם לא
  תסונכרן, כי הסנכרון רץ בדף השני.
- **זה מקור אמת שני** — בדיוק מה שכלל קריטי 1 של הריפו אוסר (קובץ ראשי יחיד).
  הוא מתיישן בכל שחרור.
- **מה שהוא אמור לפתור כבר פתור**: אחרי עלייה מוצלחת אחת, ה-service worker מגיש
  הכול אופליין ושכבת ה-MIRROR עובדת בלי רשת. המקרה היחיד שנשאר הוא **התקנה
  והפעלה ראשונה בלי רשת בכלל** — ולהתקנת APK ממילא צריך רשת, ואז המעטפת מציגה
  דף שגיאה בעברית עם כפתור «נסה שוב».

### ⚠️ מעבר-origin חד-פעמי: TWA / דפדפן ← APK חדש
ה-WebView של האפליקציה מחזיק **מחיצת אחסון משלו**, נפרדת מזו של הדפדפן באותו
מכשיר. מי שעבד עד עכשיו בדפדפן ועובר ל-APK מתחיל עם localStorage **ריק**: כניסה
מחדש, וה-MIRROR נטען מהענן — שהוא ממילא מקור האמת.

⛔ **מה שכן יכול ללכת לאיבוד: רשומה שנרשמה בדפדפן וטרם עלתה לענן.** לכן —
**לפני מעבר מכשיר ל-APK, ודא בדפדפן שמסך ההגדרות ← «⏳ ממתין לסנכרון» מציג 0.**

## אייקונים

⚠️ **פרק פרטי ל-gius** — היא האפליקציה היחידה מהארבע שמחוללת את האייקונים
בסקריפט (`tools/gen-icons.mjs`, חריגה מנומקת ב-`check-structure.mjs`).


נוצרים אוטומטית ע"י `node tools/gen-icons.mjs` בשורש הריפו — אותו סקריפט
שמייצר את אייקוני ה-PWA, מאותה מתמטיקת פיקסלים. **לא לערוך ידנית** את
`res/mipmap-*/`. הרקע של ה-adaptive icon הוא `res/drawable/ic_launcher_background.xml`
(טורקיז המותג `#0F766E`).

## Build

### הדרך המומלצת — GitHub Actions (לא צריך שום דבר מותקן)

`.github/workflows/build-apk.yml`: Actions → **Build APK** → **Run workflow**.
ה-APK **החתום** יורד כ-artifact בשם `gius-apk`.

החתימה נעשית ב-`signing/sign-apk.sh` מול `signing/gius.keystore` שבריפו —
**אין secret ואין קלט ידני**, ולכן אין דרך לבנות בטעות APK במפתח אחר. הסקריפט
מסרב לחתום אם טביעת האצבע של ה-keystore אינה `92:33:21:96:...:81:7D`, ואחרי
החתימה מוודא שה-APK אכן נושא את התעודה הזו — ה-workflow נכשל בכל אחד מהמקרים.

> ⚠️ **המפתח הוחלף ב-2026-08-19 (סבב 39).** APK חדש ⛔ אינו מתקין על גבי התקנה
> שנחתמה במפתח הישן — נדרשת הסרה והתקנה מחדש, פעם אחת. ר' CLAUDE.md.

### בנייה מקומית (דורשת Android SDK + Gradle)

```bash
cd android
gradle wrapper --gradle-version 8.7   # פעם אחת
./gradlew :app:assembleRelease
# פלט לא חתום:
#   android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## Sign with the PERMANENT key (required so it installs over previous builds)

```bash
../signing/sign-apk.sh app/build/outputs/apk/release/app-release-unsigned.apk gius.apk
```

הסקריפט מריץ `zipalign` ואז `apksigner` מול `signing/gius.keystore`
(alias `gius`), ואוכף את טביעת האצבע לפני ואחרי החתימה.

> **ה-keystore נמצא בריפו** — `signing/gius.keystore`, בדיוק כמו
> `signing/yoman.keystore` ב-yoman-avoda. ⛔ זהו קובץ ה-keystore **היחיד**
> ב-`signing/` מסבב 39; שני הקבצים הקודמים נמחקו.
