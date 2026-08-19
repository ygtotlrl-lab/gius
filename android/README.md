# gius — Native WebView APK

מעטפת אנדרואיד מקורית מבוססת **WebView** — **לא TWA**. היא טוענת את האתר החי:

```
https://ygtotlrl-lab.github.io/gius/
```

## Why WebView and never a TWA

<!-- SHARED:start id="android-why-twa" -->
**Do not rebuild this as a TWA, and do not use PWABuilder** (it only produces
TWAs). A TWA is not a standalone component — it runs the site *inside Chrome*
and merely hides the address bar. The content filtering installed on the users'
devices blocks Chrome, so a TWA build never opens at all. A WebView renders
in-process and never goes through Chrome, so the filter does not touch it.
<!-- SHARED:end -->

⚠️ **וכאן זה נמדד על הבשר, ולא בתיאוריה:** ה-APK הראשון של gius נבנה ב-PWABuilder
כ-TWA ופשוט **לא נפתח** אצל המשתמשים, בעוד ש-`yoman-avoda` ו-`hanhala` — שתיהן
WebView — עבדו. ⛔ **אין להחזיר את המעטפת ל-TWA ואין לבנות מחדש ב-PWABuilder** —
זה יחזיר את התקלה.

## מה בפנים

| | |
|---|---|
| **Package ID** | `com.gius.app` — זהה ל-TWA שהוא מחליף (חובה, אחרת זו אפליקציה נפרדת) |
| **שם** | גיוס |
| **טוען** | `https://ygtotlrl-lab.github.io/gius/` — מהרשת, לא מנכסים מוטבעים |
| **versionCode** | 4 — קודם בסבב 41. 3 = סבב 40, 2 = המעטפת הראשונה של WebView; ה-TWA היה 1, וכל התקנה מעליו חייבת להיות גבוהה יותר |
| **minSdk / targetSdk** | 21 / 34 |
| **WebView** | JavaScript, DOM storage (localStorage — שם יושב ה-session), DB |
| **קישורי `tel:`** | נמסרים למערכת (חיוג לתורם). כל `http`/`https` נשאר בתוך המעטפת |
| **בורר קבצים** | `WebChromeClient.onShowFileChooser` מחובר ל-`<input type=file>` |
| **אופליין** | ה-service worker של האתר. המעטפת מציגה דף שגיאה בעברית רק בהפעלה ראשונה בלי רשת |

<!-- SHARED:start id="android-web-update" -->
**עדכוני קוד web לא מצריכים APK חדש.** כל דחיפה ל-`main` מגיעה למכשירים דרך
אותו מנגנון service worker + באנר "גרסה חדשה זמינה" שכבר עובד בדפדפן. APK חדש
נדרש רק כששינוי נוגע במעטפת עצמה.
<!-- SHARED:end -->

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

<!-- SHARED:start id="android-shell-split" -->
## המעטפת — ליבה משותפת ומעטפת פר-אפליקציה (סבב 41)

`MainActivity.java` היה עד סבב 41 **ארבעה עותקים חופשיים** של אותה מעטפת:
hanhala ו-schar כמעט זהות בית-לבית, gius נבדלת בניסוח, ו-yoman כפולה בגלל
גשר השיתוף. שער החתימה של סבב 40 הקפיא את המצב, ⛔ אך לא איחד אותו.

מעכשיו הקוד מפוצל לשניים:

| קובץ | מה יש בו |
|---|---|
| `ShellActivity.java` | **הליבה המשותפת** — הגדרות ה-WebView, בורר הקבצים, `shouldOverrideUrlLoading`, דף האופליין, כפתור החזרה ושמירת המצב. ⭐ **זהה בית-לבית בארבעת הריפו** פרט לשורת ה-`package`. |
| `MainActivity.java` | **זהות בלבד** — הכתובת, משפט האופליין וצבע הכפתור, דרך שלוש מתודות. |

⛔ **אין להוסיף לוגיקה ל-`MainActivity`** (סבב 41) — התנהגות שנוספת
לאפליקציה אחת בלבד מחזירה בדיוק את ארבעת העותקים שהחילוץ החליף. מה שנחוץ
לכולן נכנס ל-`ShellActivity`; מה שנחוץ לאחת עובר דרך שתי הווים שהליבה
חושפת — `installBridge()` ו-`onShellNavigation(String)` — ונרשם כחריגה
מנומקת.

⚠️ **החריגה היחידה היום היא גשר השיתוף של yoman-avoda**, והיא מדודה: הליבה
נושאת חתימה אחת בארבעתן (`d8efd10bc6d47354`), ורק המעטפת של yoman נבדלת.
`tools/test_round40_shell.mjs` אוכף את שתי החתימות, ו⛔ **נכשל אם נמצא גשר
בליבה** — גשר שם היה מגיע לארבע האפליקציות בבת אחת.
<!-- SHARED:end -->

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

או ידנית — ר' הפרק "חתימת APK" ב-CLAUDE.md (מפתח `signing/gius.keystore`,
alias `gius`). אחרי חתימה מאמתים שה-SHA256 תואם לטבלה שם.
