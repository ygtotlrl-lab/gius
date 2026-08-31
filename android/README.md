# gius — Native WebView APK

מעטפת אנדרואיד מקורית מבוססת **WebView** — **לא TWA**. היא טוענת את האתר החי:

```
https://ygtotlrl-lab.github.io/gius/
```

## מה בפנים

| | |
|---|---|
| **Package ID** | `com.gius.app` — זהה ל-TWA שהוא מחליף (חובה, אחרת זו אפליקציה נפרדת) |
| **שם** | גיוס |
| **טוען** | `https://ygtotlrl-lab.github.io/gius/` — מהרשת, לא מנכסים מוטבעים |
| **versionCode** | 16 — קודם בסבב 76 (כיול תיבת התוכן בשני הממדים: הצלע הנמדדת שווה ליעד גם בגובה, ולכן L=R ו-T=B בכל אחד מ-16 הנכסים). 15 — קודם בסבב 75 (עשרת קובצי ה-mipmap נגזרו מחדש: צלע התוכן מעוגלת למספר זוגי לפני המיקום, ולכן השוליים מתחלקים שווה). 14 — קודם בסבב 71 (כל נכסי האייקון נוצרו מחדש ע"י `tools/gen-icons.mjs`, שהוא מעכשיו מקור האמת היחיד להם). 13 — קודם בסבב 71 (ה-`ic_launcher_foreground` בגיוס נגזר מחדש אנליטית: הרדיוס החיצוני הוא בדיוק חצי מצלע התוכן, והשוליים אינם יושבים על סף האלפא). 12 — קודם בסבב 71 (חמשת קובצי `ic_launcher_foreground` נגזרו מחדש לצלע תוכן 48/72/96/144/192 בדיוק, בהכפלה מוקדמת באלפא). 11 — קודם בסבב 68 (היסטוריית הגרסאות ירדה מהערות `build.gradle` — מקור אמת שני; ⛔ הטבלה הזו היא ההיסטוריה). 10 — קודם בסבב 66 (עשרת קובצי ה-mipmap הוחלפו). 8 — קודם בתיקון שאחרי סבב 60 (קיצור ההערה המשותפת ב-`ShellActivity`, שנעשה בסבב 60 בלי קידום). 7 — קודם בסבב 58 (הסרת `FLAG_ACTIVITY_NEW_TASK` ממסירת יעד חיצוני ל-`ACTION_VIEW`). 6 = סבב 46ב (היפוך ברירת המחדל בקובצי התצורה). 5 = סבב 45, 4 = סבב 41, 3 = סבב 40, 2 = המעטפת הראשונה של WebView. ⛔ versionCode לעולם אינו יורד — מספר נמוך ממה שמותקן במכשיר חוסם את העדכון |
| **minSdk / targetSdk** | 21 / 34 |
| **WebView** | JavaScript, DOM storage (localStorage — שם יושב ה-session), DB |
| **סכמות שאינן http** | נמסרות למערכת ב-`ACTION_VIEW`. כל `http`/`https` נשאר בתוך המעטפת |
| **בורר קבצים** | `WebChromeClient.onShowFileChooser` מחובר ל-`<input type=file>` |
| **אופליין** | ה-service worker של האתר. המעטפת מציגה דף שגיאה בעברית רק בהפעלה ראשונה בלי רשת |

<!-- SHARED:start id="android-web-update" -->
**עדכוני קוד web לא מצריכים APK חדש.** כל דחיפה ל-`main` מגיעה למכשירים דרך
אותו מנגנון service worker + באנר "גרסה חדשה זמינה" שכבר עובד בדפדפן. APK חדש
נדרש רק כששינוי נוגע במעטפת עצמה.
<!-- SHARED:end -->

<!-- SHARED:start id="android-origin-switch" -->
## ⚠️ מעבר-origin חד-פעמי — ולפני כל הפצת APK

ה-WebView של האפליקציה מחזיק **מחיצת אחסון משלו**, נפרדת מזו של הדפדפן באותו
מכשיר. מי שעבד עד עכשיו בדפדפן ועובר ל-APK מתחיל עם localStorage **ריק**:
כניסה מחדש, והעותק המקומי נטען מהענן — שהוא ממילא מקור האמת.

⛔ **מה שכן יכול ללכת לאיבוד: רשומה שנרשמה במכשיר וטרם עלתה לענן.** לכן —
**לפני כל הפצת APK, ודא בכל מכשיר שההגדרות ← «⏳ ממתין לסנכרון» מציג 0.**
רשומה שמסומנת ⏳ יושבת רק באותה מחיצת אחסון, ומעבר ה-origin ישאיר אותה מאחור.

⚠️ **ואותו מעבר קורה גם בהחלפת חתימה, לא רק בהחלפת origin:** התקנה ראשונה של
בנייה שנחתמה במפתח קבוע חדש מחייבת **הסרה חד-פעמית** של האפליקציה הישנה
(חתימה שונה ⇒ אנדרואיד רואה אפליקציה זרה ⇒ `INSTALL_FAILED_UPDATE_INCOMPATIBLE`),
וההסרה מוחקת את מחיצת האחסון שלה. מאותה נקודה ואילך ההתקנות חלקות.
⛔ **גם כאן «⏳ ממתין לסנכרון» נבדק לפני ההסרה ולא אחריה** — אחריה כבר אין מה
לבדוק.
<!-- SHARED:end -->

⚠️ **כאן המעבר היה מ-TWA** — ה-APK הראשון נבנה ב-PWABuilder ורץ בתוך כרום.
⭐ **ובסבב 39 הוחלף גם ה-keystore**, ולכן שני המכשירים שבשטח עברו הסרה
והתקנה בפועל; נמדד לפני כן שאין בהם נתונים שלא סונכרנו.

<!-- SHARED:start id="android-icons" -->
## אייקונים

אייקוני המעטפת יושבים ב-`android/app/src/main/res/` — **עשרה קובצי `mipmap`**
(`ic_launcher.png` ו-`ic_launcher_foreground.png` בכל אחת מחמש הרזולוציות)
ו**קובץ XML אדפטיבי אחד**, `mipmap-anydpi-v26/ic_launcher.xml`, שהרקע שלו הוא
`res/drawable/ic_launcher_background.xml`.
⭐ **נמדד בארבעת הריפו — אותו מבנה בדיוק בכולן.**

⛔ **אין לערוך את קובצי ה-`mipmap` ידנית** — כולם נגזרים ממקור גרפי אחד, וכל
עריכה ידנית היא גרסה שנייה שתידרס בגזירה הבאה בלי שאיש יידע.
⚠️ **המקור עצמו נבדל פר-אפליקציה**, והוא מתועד בשורה שמתחת.
<!-- SHARED:end -->
### הסט כאן
`node tools/gen-icons.mjs` מייצר את כל ה-PNG-ים מחישוב פיקסלים (ללא
ספריות), לשני יעדים: `icons/` (PWA ופאביקון) ו-`android/app/src/main/res/
mipmap-*/` — `ic_launcher.png` ו-`ic_launcher_foreground.png` (הסימן בלבד
על רקע שקוף; הרקע מ-`ic_launcher_background.xml`), עם `pad` שמכניס את
החזית לאזור הבטוח של 66dp מתוך 108dp.
⛔ **אין לערוך את הקבצים ידנית** — משנים את הסקריפט ומריצים מחדש. הוא
דטרמיניסטי: הרצה חוזרת בלי שינוי קוד מייצרת קבצים זהים בית-לבית.

⚠️ **המקור כאן הוא סקריפט ולא קובץ גרפי, וזו חריגה מנומקת** — gius היא
האפליקציה היחידה מהארבע שמחוללת את האייקונים ב-`node tools/gen-icons.mjs`
(אותו סקריפט שמייצר גם את אייקוני ה-PWA, מאותה מתמטיקת פיקסלים; חריגה רשומה
ב-`check-structure.mjs`). הרקע האדפטיבי הוא טורקיז המותג `#0F766E`.

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
`tools/test_shell.mjs` אוכף את שתי החתימות, ו⛔ **נכשל אם נמצא גשר
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
> שנחתמה במפתח הישן — נדרשת הסרה והתקנה מחדש, פעם אחת..

### בנייה מקומית (דורשת Android SDK + Gradle)

```bash
cd android && gradle wrapper --gradle-version 8.7 && ./gradlew :app:assembleRelease
# פלט לא חתום: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## Sign with the PERMANENT key (required so it installs over previous builds)

```bash
../signing/sign-apk.sh app/build/outputs/apk/release/app-release-unsigned.apk gius.apk
```

הסקריפט מריץ `zipalign` ואז `apksigner`, ⛔ ואוכף את טביעת האצבע לפני
ואחרי החתימה.

### פרטי המפתח הקבוע

| | |
|---|---|
| **קובץ** | `signing/gius.keystore` (PKCS12, RSA 2048, SHA256withRSA) |
| **נוצר** | 2026-08-19 (סבב 39), `keytool -genkeypair` |
| **Package ID** | `com.gius.app` |
| **alias** | `gius` |
| **storepass / keypass** | `gius123` (זהה לשניהם) |
| **תוקף** | 10,000 יום — 110.08.2026 עד 04.01.2054 |
| **SHA256** | `92:33:21:96:75:17:2D:54:91:35:12:1D:64:46:A6:74:E0:E2:0C:24:9F:68:4A:C3:FA:A2:B7:CC:B8:D3:81:7D` |
| **SHA1** | `FA:AA:8E:84:8C:71:95:5B:E0:62:33:13:C5:BB:50:A3:04:E5:86:DE` |
| **DN** | `CN=gius, OU=Yeshiva, O=Yeshiva, L=Rishon LeZion, ST=Israel, C=IL` |

### פרטי המעטפת
`applicationId` חייב להישאר `com.gius.app`, ו-`versionCode` גבוה מזה של
ה-TWA שהוחלף (ה-TWA היה 1; המעטפת היא 2).

⚠️ **בסביבת הענן אין Android SDK ו-`dl.google.com` חסום** — הדרך המעשית
היא ה-workflow. ⛔ ולא PWABuilder: הוא יודע לייצר TWA בלבד.

<!-- SHARED:start id="android-smali-scope" -->
## תיקון URL ב-APK קיים ובנוי (בלי מקור) — smali בלבד

⚠️ **הפרק הזה רלוונטי רק ל-APK ישן שנבנה לפני `android/`.** בנייה רגילה היום
היא מ-`android/` דרך `.github/workflows/build-apk.yml`, והמעטפת טוענת מהרשת —
ולכן אין בה URL שצריך לתקן.
⛔ **smali בלבד — לא binary patch.** עריכה בינארית של ה-APK שוברת את החתימה
ואינה ניתנת לאימות, ⛔ והחתימה מחדש היא במפתח הקבוע של הריפו בלבד — ר' הפרק
«Sign with the PERMANENT key» שלמעלה.
⭐ **שני הקבצים שנושאים את ה-URL הם `MainActivity.smali` ו-`MainActivity$2.smali`**
— ⛔ וההוראה זהה בארבעת הריפו; הכתובת עצמה, שם תיקיית העבודה והמפתח הם
פר-אפליקציה, ⛔ ויושבים בבלוק שמתחת.
<!-- SHARED:end -->

```bash
apktool d <app>.apk -o /tmp/gius_work -f
rm -rf /tmp/gius_work/build          # חובה לפני בנייה חוזרת
apktool b /tmp/gius_work -o built.apk
zipalign -f 4 built.apk aligned.apk
apksigner sign --ks signing/gius.keystore --ks-key-alias gius \
  --ks-pass pass:gius123 --key-pass pass:gius123 --out output.apk aligned.apk
```

⚠️ **ה-APK הישן כאן היה TWA** שנבנה ב-PWABuilder, ⛔ ואין לבנות אותו מחדש
⭐ וה-keystore הוחלף בסבב 39 — כל חתימה היא
ב-`signing/gius.keystore` בלבד.

<!-- SHARED:start id="android-cache-apk" -->
### ⚠️ Cache APK — כלל זהב

שם קובץ חוזר נתפס במטמון — של הדפדפן, של מנהל ההורדות ושל המכשיר — והמשתמש
מתקין שוב את הבנייה **הקודמת** בלי לדעת. ⛔ **תמיד שם חדש בכל בנייה**, עם
חותמת זמן:
<!-- SHARED:end -->

```bash
TS=$(date +%s) && apksigner sign ... --out gius-${TS}.apk
```
