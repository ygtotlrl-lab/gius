# gius — Native WebView APK

A native Android **WebView** shell (not a TWA) that loads the **live site** over the
network:

```
https://ygtotlrl-lab.github.io/gius/
```

## Why WebView and never a TWA

**Do not rebuild this as a TWA, and do not use PWABuilder** (it only produces
TWAs). A TWA is not a standalone component — it runs the site *inside Chrome*
and merely hides the address bar. The content filtering installed on the users'
devices blocks Chrome, so a TWA build never opens at all. A WebView renders
in-process and never goes through Chrome, so the filter does not touch it.

This is measured, not theoretical: gius shipped a PWABuilder TWA and **did not
open on the users' devices**, while yoman and hanhala — both WebView — work.
That measurement is what produced this shell.

## מה בפנים

| | |
|---|---|
| **Package ID** | `com.gius.app` — זהה ל-TWA שהוא מחליף (חובה, אחרת זו אפליקציה נפרדת) |
| **שם** | גיוס |
| **טוען** | `https://ygtotlrl-lab.github.io/gius/` — **מהרשת**, לא מנכסים מוטבעים |
| **versionCode** | 2 (ה-TWA היה 1; חייב להיות גבוה יותר כדי להתקין מעליו) |
| **minSdk / targetSdk** | 21 / 34 |
| **WebView** | JavaScript, DOM storage (localStorage — שם יושבים `g_mirror_*`/`g_pending`/ה-session), DB |
| **ניווט** | כל `http`/`https` **נשאר בתוך המעטפת**. שאר הסכימות (`tel:` לחיוג לתורם, `mailto:`, …) נמסרות למערכת |
| **בורר קבצים** | `WebChromeClient.onShowFileChooser` מחובר ל-`<input type=file>` |
| **אופליין** | ה-service worker + המראה המקומית של האתר. המעטפת מציגה דף שגיאה בעברית **רק** בהפעלה ראשונה בלי רשת |

**עדכוני קוד web לא מצריכים APK חדש.** כל דחיפה ל-`main` מגיעה למכשירים דרך
אותו מנגנון service worker + באנר "גרסה חדשה זמינה" שכבר עובד בדפדפן. APK חדש
נדרש רק כששינוי נוגע במעטפת עצמה.

## ⛔ אין גשר שיתוף — וזה ההבדל היחיד מהתבנית של יומן

למעטפת של yoman-avoda יש `AndroidShareBridge` (מוגבל-origin, בשני מנעולים) כי הדף
שלה קורא ל-`navigator.share` עם תמונת דו"ח. **בקוד של gius אין `navigator.share`
בכלל**, ולכן הגשר הושמט כליל — אין `addJavascriptInterface`, לא בצד Java ולא בצד
הדף.

גשר מקורי על דף שנטען מהרשת הוא כוח שנמסר למי שמגיש את הדף. אם אי-פעם יידרש כאן
גשר — מעתיקים את הדפוס הכפול-נעילה של יומן (`WebViewCompat.addWebMessageListener`
עם `ALLOWED_ORIGINS`, ונפילה-חזרה שמחוברת רק על ה-origin שלנו). **לעולם לא
`addJavascriptInterface` חשוף.**

## למה אין נכסים מוטבעים

- ⛔ **`file://` הוא origin אחסון אחר.** ה-localStorage של `file://` ושל
  `https://ygtotlrl-lab.github.io` הן שתי מחיצות נפרדות לחלוטין. תנועה או
  התחייבות שנרשמו לעותק מוטבע בעלייה ראשונה **לא נראות לאפליקציה האמיתית
  לעולם** — והן גם לא יסונכרנו, כי הסנכרון רץ בדף השני.
- **זה מקור אמת שני** — בדיוק מה שכלל קריטי 1 של הריפו אוסר. הוא מתיישן בכל שחרור.
- **מה שהוא אמור לפתור כבר פתור**: אחרי עלייה מוצלחת אחת, ה-service worker מגיש
  הכול אופליין והמראה המקומית (`MIRROR`) עובדת בלי רשת. המקרה היחיד שנשאר הוא
  **התקנה + הפעלה ראשונה בלי רשת בכלל** — ולהתקנת APK ממילא צריך רשת. במקרה הזה
  המעטפת מציגה דף שגיאה בעברית עם כפתור "נסה שוב".

### ⚠️ מעבר-origin חד-פעמי: TWA / דפדפן ← APK
ה-WebView של האפליקציה מחזיק **מחיצת אחסון משלו**, נפרדת מזו של הדפדפן באותו
מכשיר. מי שעבד עד עכשיו בדפדפן ועובר ל-APK מתחיל עם localStorage **ריק**: כניסה
מחדש, והמראה נטענת מהענן — שהוא ממילא מקור האמת.

⛔ **מה שכן יכול ללכת לאיבוד: רשומה שנרשמה בדפדפן וטרם עלתה לענן.** לכן —
**לפני מעבר מכשיר ל-APK, ודא בדפדפן שההגדרות ← «⏳ ממתין לסנכרון» מציג 0.**
רשומה שמסומנת ⏳ יושבת רק באותה מחיצת אחסון, ומעבר ה-origin ישאיר אותה מאחור.

## אייקונים

⚠️ **פרק פרטי ל-gius** — היא האפליקציה היחידה מהארבע שמחוללת את האייקונים
מקוד ולא מקובץ מאסטר גרפי (`tools/gen-icons.mjs`, חריגה מנומקת ברשימת-ההיתר
של `check-structure.mjs`).

נוצרים אוטומטית ע"י `node tools/gen-icons.mjs` בשורש הריפו — אותו סקריפט
שמייצר את אייקוני ה-PWA, מאותה מתמטיקת פיקסלים. **לא לערוך ידנית** את
`res/mipmap-*/`. הרקע של ה-adaptive icon הוא `res/drawable/ic_launcher_background.xml`
(טורקיז המותג `#0F766E`).

## Build

### הדרך המומלצת — GitHub Actions (לא צריך שום דבר מותקן)

`.github/workflows/build-apk.yml`: Actions → **Build APK** → **Run workflow**.
ה-APK **החתום** יורד כ-artifact בשם `gius-apk`.

החתימה נעשית ב-`signing/sign-apk.sh` מול `signing/pwabuilder.keystore` שבריפו —
**אין secret ואין קלט ידני**, ולכן אין דרך לבנות בטעות APK במפתח אחר.

### בנייה מקומית (דורשת Android SDK + Gradle)

```bash
cd android
gradle wrapper --gradle-version 8.7   # פעם אחת
./gradlew :app:assembleRelease
# Unsigned APK output:
#   android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## Sign with the PERMANENT key (required so it installs over previous builds)

```bash
../signing/sign-apk.sh app/build/outputs/apk/release/app-release-unsigned.apk gius.apk
```

הסקריפט מריץ `zipalign` ואז `apksigner` מול `signing/pwabuilder.keystore`
(alias `my-key-alias`). הוא **מסרב לחתום** אם טביעת האצבע של ה-keystore אינה
`DA:61:B1:4D:...:FC:4C`, ואחרי החתימה מוודא שה-APK אכן נושא את התעודה הזו —
ה-workflow נכשל בכל אחד מהמקרים. ר' הפרק "חתימת APK" ב-CLAUDE.md.

> **ה-keystore נמצא בריפו** — `signing/pwabuilder.keystore`, בדיוק כמו
> `signing/yoman.keystore` ב-yoman-avoda. שים לב ש-`signing/gius.keystore`
> שלידו הוא המפתח הידני הישן ו**אינו בשימוש** — ההבחנה היא בטביעת האצבע.
