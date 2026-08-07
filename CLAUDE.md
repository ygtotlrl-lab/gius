# gius — ניהול גיוס כספים

אפליקציית PWA לניהול גיוס כספים. עברית מלאה, RTL, מובייל ודסקטופ.

- **Live:** https://ygtotlrl-lab.github.io/gius/
- **Deploy:** GitHub Pages מענף `main` (שורש הריפו). אין שלב build — מה שבריפו הוא מה שרץ.
- **Supabase project ref:** `zrftjkghhjhqzopvdzou` — פרויקט ייעודי, לא משותף עם אפליקציות אחרות בארגון.
- **קידומת טבלאות:** `g_`

---

## מבנה הריפו

```
index.html                 האפליקציה כולה — HTML + CSS + JS מוטבעים. קובץ אחד.
sw.js                      service worker
manifest.json              PWA manifest
.nojekyll                  מנטרל Jekyll — בלעדיו GitHub Pages לא מגיש תיקיות שמתחילות בנקודה
.well-known/assetlinks.json  אימות בעלות ל-TWA. חייב להתאים לטביעת המפתח החותם.
icons/                     אייקונים (נוצרים ע"י scripts/gen-icons.mjs — לא לערוך ידנית)
migrations/0001_init.sql   סכמת הבסיס. להריץ ידנית מול הפרויקט.
scripts/check-js.mjs       שער חובה לפני כל push
scripts/gen-icons.mjs      מחולל האייקונים
signing/gius.keystore      keystore ידני — 🚫 לא בשימוש. נשמר לתיעוד, לא למחוק.
signing/sign-apk.sh        סקריפט חתימה שמפנה ל-keystore הלא-פעיל — לא בשימוש
```

---

## כללי ברזל

### 1. קובץ ראשי יחיד
כל ה-CSS וה-JS מוטבעים ב-`index.html`. אין bundler, אין קבצי JS/CSS חיצוניים משלנו,
אין שלב build. תלות חיצונית יחידה: supabase-js מ-CDN.

### 2. נעילת גרסאות CDN
תמיד גרסה מדויקת, **לעולם לא major צף**:

```
https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0/dist/umd/supabase.js
```

`@2` ייכשל בבדיקה של `scripts/check-js.mjs`. הגרסה מופיעה בשני מקומות —
`index.html` וברשימת `CDN_ASSETS` ב-`sw.js`. שינוי גרסה מחייב עדכון בשניהם.

### 3. בדיקת תחביר לפני כל push — חובה

```bash
node scripts/check-js.mjs
```

הסקריפט מחלץ כל בלוק `<script>` מוטבע מ-`index.html`, מריץ עליו `node --check`,
ומריץ `node --check` גם על `sw.js`. בנוסף הוא מוודא את הכללים שפרסר לא תופס
(שם המטמון, דילוג על supabase, `mode:'cors'`, Content-Type בדף האופליין,
סריקת מטמון לפי קידומת, נעילת גרסת CDN). **אסור לדחוף אם הוא נכשל.**
הכל בקובץ אחד — שגיאת תחביר אחת מחזירה מסך לבן, בלי אזהרה.

### 4. מחיקה רכה בלבד
לכל טבלת ישות יש `deleted` + `deleted_at`. אין `DELETE` פיזי, בשום מקום.
כדי לאכוף את זה גם ברמת מסד הנתונים, **תפקיד `anon` לא מקבל הרשאת DELETE** —
רק `SELECT, INSERT, UPDATE`. כל קריאה מסננת `.eq('deleted', false)`.
משתמשים הם החריג: הם לא נמחקים אף פעם, השדה `active` הוא המחיקה הרכה שלהם.

> **מלכודת:** `GRANT` הוא אדיטיבי בלבד — הוא לא מסיר כלום. פרויקט Supabase
> סטנדרטי מגיע עם `alter default privileges in schema public grant all on
> tables to anon, authenticated`, ולכן כל טבלה שנוצרה ב-0001 קיבלה DELETE
> ו-TRUNCATE אוטומטית, וה-`grant select, insert, update` שבסוף 0001 לא לקח
> אותם. `migrations/0002_revoke_delete.sql` עושה `REVOKE` מפורש ומתקן את זה.
> **טבלה חדשה תיוולד שוב עם DELETE** — כל מיגרציה שמוסיפה טבלה חייבת לכלול
> `revoke all` ואז `grant select, insert, update`. לבדיקה:
>
> ```sql
> select table_name, string_agg(distinct privilege_type, ', ' order by privilege_type)
> from information_schema.role_table_grants
> where grantee = 'anon' and table_schema = 'public' and table_name like 'g\_%'
> group by table_name;
> ```

### 5. `updated_at` בכל שינוי
לכל רשומה בכל טבלה יש `updated_at`, ומטופל ע"י טריגר `g_touch_updated_at`
בצד השרת — לא בהסתמכות על הלקוח. זה הבסיס למנוע מיזוג עתידי, ולכן הוא חייב
להיות אמין.

### 6. אין סכומים מחושבים שמורים
`נגבה`, `נותר` וסטטוס התחייבות **אף פעם** לא נשמרים בטבלה. הכל מחושב בזמן ריצה
מ-`g_txns`. אין עמודות `collected` / `balance` / `status` — ולא להוסיף כאלה.

### 7. RLS פתוח — החלטה מודעת
RLS מופעל על כל טבלה, עם policy פתוחה (`using (true) with check (true)`)
ו-GRANT מפורש ל-`anon`. זהו כלי פנימי עם טבלת התחברות משלו (`g_users`);
ההרשאות נאכפות בשכבת האפליקציה, לא ב-Postgres. **מי שמחזיק את מפתח ה-anon
יכול לקרוא ולכתוב הכל.** זו החלטה מודעת ומתועדת, לא פספוס.

> סיסמאות ב-`g_users` נשמרות כטקסט גלוי, לפי אפיון. בשילוב עם RLS הפתוח,
> כל מי שמגיע למפתח ה-anon רואה את כל הסיסמאות. אם האפליקציה תיחשף מעבר
> לצוות הפנימי — לעבור ל-Supabase Auth או לכל הפחות ל-hash בצד השרת.

### 8. אין נתוני דמה
בבסיס יש רק את המשתמש הראשוני ואת רשימות הבחירה. שום תורם, התחייבות, תנועה
או משימה לדוגמה — לא בקוד ולא ב-migration.

### 9. ⚠️ קידום `CACHE_NAME` ב-`sw.js` בכל שינוי קוד — חובה
**כל שינוי ב-`index.html` (או בכל נכס אחר ב-`CORE`) מחייב קידום המספר ב-`CACHE_NAME`**
(`gius-v1` → `gius-v2` → …). בלי זה ה-`install` מוצא מטמון קיים באותו שם, ה-`activate`
לא מנקה כלום, ומשתמש שכבר ביקר באפליקציה ממשיך לקבל **את הקליפה הישנה מהמטמון** —
הקוד החדש פשוט לא מגיע אליו, בלי שום סימן שמשהו לא בסדר.

> **מצב נוכחי:** `CACHE_NAME` נשאר `gius-v1` מאז ההקמה, ולאורך כל השחרורים שמאז.
> המשמעות: כל מי שהתקין או ביקר בגרסה מוקדמת מחזיק קליפה מיושנת. **השחרור הבא
> חייב לקדם את המספר** כדי לשחרר אותם.

הכלל הזה משלים את סעיף 8 בפרק ה-service worker (אין `skipWaiting()` ב-install):
הקידום הוא שגורם ל-SW חדש להיכנס למצב `waiting`, וזה מה שמדליק את באנר
"🔄 גרסה חדשה זמינה". בלי קידום — אין SW חדש, אין באנר, אין עדכון.

---

## מבנה הנתונים

כל המזהים `uuid` עם `gen_random_uuid()` (ולא רצף) — מזהה שנוצר בצד הלקוח בעתיד
לא יתנגש, וזה תנאי למנוע מיזוג.

### `g_users` — משתמשי המערכת
| עמודה | טיפוס | הערות |
|---|---|---|
| `id` | uuid | PK |
| `username` | text | ייחודי |
| `password` | text | טקסט גלוי (ר' סעיף 7) |
| `full_name` | text | **המפתח שמקשר לרשומות** — `agent`, `manager`, `assignee` הם טקסט חופשי שמושווה מולו |
| `role` | text | `owner` \| `manager` |
| `active` | boolean | מחיקה רכה של משתמש |
| `created_at`, `updated_at` | timestamptz | |

### `g_donors` — תורמים
`id`, `name`, `phone`, `agent` (שגריר), `is_vip`, `notes`, `tags` (text[]),
`deleted`, `deleted_at`, `created_at`, `updated_at`

### `g_pledges` — התחייבויות
`id`, `donor_id` → `g_donors` **ON DELETE RESTRICT**, `amount`, `cause` (עילה),
`agent`, `note`, `due_date`, `deleted`, `deleted_at`, `created_at`, `updated_at`

### `g_txns` — תנועות
`id`, `donor_id` → `g_donors` **ON DELETE RESTRICT**,
`pledge_id` → `g_pledges` (nullable — תנועה יכולה לעמוד בפני עצמה),
`amount`, `txn_date`, `category` (סעיף), `agent`, `manager`, `cleared` (נפרע),
`note`, `deleted`, `deleted_at`, `created_at`, `updated_at`

### `g_tasks` — משימות
`id`, `title`, `stage` (`הכנה`/`הרצה`/`השלמה`/`חסומה`), `assignee`, `domain`,
`due_date`, `log`, `deleted`, `deleted_at`, `created_at`, `updated_at`

`log` הוא טקסט מצטבר. כל רישום נוסף בשורה חדשה בפורמט
`[dd.mm.yyyy · שם המשתמש] טקסט`. לא דורסים רישומים קיימים.

### `g_targets` — יעד חודשי
`id`, `month` (`YYYY-MM`, ייחודי, עם CHECK), `amount`, `created_at`, `updated_at`

### `g_config` — רשימות הניתנות לעריכה
`key` (PK), `value` (jsonb — מערך מחרוזות), `updated_at`

מפתחות: `categories` (סעיפי תנועה), `causes` (עילות התחייבות), `domains` (תחומי משימות).
נשמר בהחלפת המערך כולו (upsert על `key`). הרשימות האלו מזינות את כל התפריטים.

**ערכי פתיחה:**
- `categories`: תרומה, גביה, מגביות, פרוייקטים, הוראות קבע, פרנסים ותאריכים
- `domains`: כספים, שימור תורמים, תשתיות, יעד יזום
- `causes`: ריק — נבנה ע"י המשתמש

---

## חישובים

```
נגבה להתחייבות  = Σ g_txns.amount  where pledge_id = P and not deleted
סטטוס התחייבות  = 0 → "לא בוצע" | 0 < נגבה < סכום → "חלקי" | ≥ סכום → "בוצע"
נגבה בחודש      = Σ g_txns.amount  where month(txn_date) = M and not deleted
נותר בחודש      = max(0, יעד − נגבה)
אחוז            = נגבה / יעד × 100   (0 כשאין יעד)
```

הסטטוס נגזר מכל התנועות, ללא תלות ב-`cleared`. `cleared` הוא מידע תפעולי
(המחאה שטרם נפרעה) ולא משנה את הסכום שנגבה.

**הודעת מומנטום** לפי אחוז — הסף הוא "גדול או שווה":

| אחוז | הודעה |
|---|---|
| ≥ 100 | 🏆 עמדנו ביעד! |
| ≥ 75 | ⚡ כמעט שם — דחיפה אחרונה! |
| ≥ 50 | 🔥 מעל המחצית — ממשיכים! |
| ≥ 25 | 💪 רבע דרך — מומנטום! |
| < 25 | 🚀 מתחילים! |

---

## הרשאות

| | owner | manager |
|---|---|---|
| בית, תורמים, התחייבויות, משימות | ✅ | ✅ |
| רישום ועריכה של תנועות/משימות/התחייבויות/תורמים | ✅ | ✅ |
| הגדרות | ✅ | ❌ |

**כפתור ההגדרות מוצג לכולם.** מנהל שלוחץ מקבל טוסט "אין הרשאה" ולא מנווט.
זו החלטת מדיניות מכוונת — לא מסתירים כפתורים. אל "לתקן" את זה ע"י הסתרת הטאב.
מסך ההגדרות עצמו מרנדר חסימה גם אם מגיעים אליו איכשהו (הגנה בשכבה שנייה).

---

## Service worker — כללים שאסור לשבור

`CACHE_NAME = 'gius-v1'`. **להעלות את המספר בכל שחרור** שמשנה נכסים — ר' כלל ברזל 9,
זו חובה ולא המלצה.

1. **סריקת מטמון לפי קידומת בלבד.** `activate` מוחק רק מפתחות שמתחילים ב-`gius-`.
   ה-origin `ygtotlrl-lab.github.io` משותף לכל אפליקציות הארגון —
   `caches.keys()` גורף ימחק את המטמון של האחרות.
2. **דילוג על supabase.** בקשות ל-`*.supabase.co` לא נתפסות ולא נשמרות. אין `respondWith`.
3. **CDN ב-`mode:'cors'`.** אחרת התגובה אטומה (opaque) ולא ניתנת לאימות.
4. **נפילה-חזרה של כל ניווט ל-`index.html`** — כולל כשהרשת החזירה 404.
   GitHub Pages מחזיר 404 לכל נתיב עמוק תחת `/gius/`.
5. **רק תגובה מנתיב הקליפה רשאית לרענן את `index.html` במטמון.**
   הבדיקה היא `SHELL_PATHS.has(url.pathname)`. בלעדיה, ניווט ל-`/gius/x/y`
   ישמור את גוף ה-404 תחת `index.html` וירעיל את המטמון — האפליקציה תיפול אופליין.
   זו הנקודה הכי שברירית בקובץ.
6. **דף אופליין בעברית** עם `Content-Type: text/html; charset=utf-8` מפורש.
7. **תג `<base>` דינמי ב-`index.html`.** כשה-SW מגיש את הקליפה בנתיב עמוק,
   הדף רץ בכתובת כמו `/gius/donors/x` וכל URL יחסי היה נפתר רמה אחת או יותר
   עמוק מדי — `manifest.json`, `sw.js` והאייקונים היו מחזירים 404, וה-SW היה
   נרשם ב-scope שגוי. סקריפט קצר בראש ה-`<head>`, **לפני כל תג עם URL יחסי**,
   מחשב את שורש האפליקציה ומזריק `<base>`. אסור להזיז אותו למטה.
8. **אין `skipWaiting()` ב-install.** הדף מציג באנר "🔄 גרסה חדשה זמינה" עם כפתור
   "עדכן עכשיו"; רק לחיצה שולחת `{type:'SKIP_WAITING'}`, ו-`controllerchange`
   מרענן פעם אחת.

---

## חתימת APK — מפתח קבוע (לעולם לא משתנה!)

**המפתח הקבוע של הפרויקט הוא ה-keystore ש-PWABuilder ייצר בבניית ה-APK.** הוא זה
שחתם את הגרסה שהותקנה בפועל אצל המשתמשים, ולכן הוא — ורק הוא — המפתח של gius מכאן
והלאה. ה-keystore הידני שיצרנו לפני כן (`signing/gius.keystore`) **אינו בשימוש**.

| | |
|---|---|
| **מקור** | keystore שנוצר ע"י PWABuilder בבניית ה-APK |
| **Package ID** | `com.gius.app` |
| **alias** | `my-key-alias` |
| **storepass** | `uqNfubfXeOyp` |
| **keypass** | `uqNfubfXeOyp` (זהה ל-storepass) |
| **SHA256** | `DA:61:B1:4D:3E:46:B7:AE:82:8C:E6:D0:77:4A:6E:43:4D:1F:F6:E0:91:B7:0C:7C:EF:29:2D:02:A1:31:FC:4C` |

> **איפה הקובץ:** PWABuilder מוסר את ה-keystore בחבילת ההורדה של ה-APK (יחד עם
> `signing-key-info.txt`). **הוא לא בריפו** — יש לשמור אותו בגיבוי בטוח מחוץ למכונת
> הבנייה. אם הוא יאבד, אין שום דרך לשחזר אותו, וכל המשתמשים הקיימים ייאלצו להסיר
> ולהתקין מחדש.

### 🚫 `signing/gius.keystore` — לא פעיל

| | |
|---|---|
| **קובץ** | `signing/gius.keystore` (PKCS12, RSA 2048) |
| **alias** | `gius` |
| **storepass / keypass** | `gius123` |
| **תוקף** | 10,000 יום — 07.08.2026 עד 23.12.2053 |
| **SHA256** | `74:48:32:F5:58:92:79:95:FA:7B:61:7A:48:3D:BB:4E:9B:B1:72:1B:46:F9:C6:03:B6:7C:DA:8E:18:91:7D:95` |
| **SHA1** | `FC:DC:62:EC:4C:45:04:E2:F6:99:9B:96:39:8F:95:47:F9:FC:86:13` |
| **DN** | `CN=gius, OU=Yeshiva, O=Yeshiva, L=Rishon LeZion, ST=Israel, C=IL` |

הקובץ נוצר לפני שהתברר ש-PWABuilder חותם במפתח משלו. **שום APK מותקן לא נחתם בו.**
אסור לחתום בו APK חדש — חתימה בו תיצור אפליקציה זרה מול ההתקנות הקיימות.
**לא למחוק אותו** — הוא נשאר בריפו כתיעוד היסטורי, מסומן כלא-פעיל.
`signing/sign-apk.sh` מפנה לקובץ הזה, ולכן גם הוא לא בשימוש כמות שהוא.

### ⛔ אזהרה — אין להחליף את המפתח לעולם

אנדרואיד מזהה אפליקציה מותקנת לפי **חתימת המפתח**, לא לפי שם הקובץ או מספר הגרסה.
APK שנחתם במפתח אחר נחשב אפליקציה **זרה**, וההתקנה מעל הקיימת נכשלת בשגיאת
`INSTALL_FAILED_UPDATE_INCOMPATIBLE`.

**המשמעות המעשית של החלפת מפתח:** כל משתמש שכבר התקין יצטרך **להסיר את האפליקציה
ולהתקין מחדש** — ואין דרך לעקוף את זה. אין שחזור, אין מיגרציה, אין "חתימה מחדש
במפתח הישן" אחרי שהוא אבד.

לכן:
1. **כל בנייה עתידית חייבת להיחתם במפתח של PWABuilder** (`my-key-alias`), גם אם
   נבנתה בכלי אחר (Bubblewrap, Android Studio). ב-PWABuilder יש לבחור
   **"Use my existing signing key"** ולהעלות את ה-keystore השמור — לעולם לא
   "Create new signing key".
2. **לעולם לא להריץ `keytool -genkeypair`** עבור הפרויקט הזה.
3. **ה-Package ID חייב להישאר `com.gius.app`.** גם שינוי שלו יוצר אפליקציה נפרדת.
4. אחרי חתימה — לאמת שה-SHA256 תואם לטבלה למעלה.
5. **`.well-known/assetlinks.json` חייב להתאים לטביעת האצבע.** אם המפתח משתנה
   מכל סיבה — הקובץ חייב להתעדכן באותה נשימה, אחרת ה-TWA יאבד את אימות הבעלות
   וייפתח כדפדפן. ר' הפרק הבא.

### חתימה

```bash
apksigner sign --ks <pwabuilder-keystore> --ks-key-alias my-key-alias \
  --ks-pass pass:uqNfubfXeOyp --key-pass pass:uqNfubfXeOyp app.apk
```

חלופה (jarsigner, אם אין apksigner):
```bash
jarsigner -keystore <pwabuilder-keystore> -storepass uqNfubfXeOyp \
  -keypass uqNfubfXeOyp app.apk my-key-alias
```

אימות טביעת האצבע — חייב להחזיר את ה-SHA256 מהטבלה:
```bash
keytool -list -v -keystore <pwabuilder-keystore> -storepass uqNfubfXeOyp
apksigner verify --print-certs app.apk
```

---

## אימות בעלות ל-TWA — `.well-known/assetlinks.json`

ה-APK הוא TWA (Trusted Web Activity). אנדרואיד פותח אותו במצב אפליקציה מלא **רק אם**
האתר מצהיר שהוא מכיר בחבילה — דרך Digital Asset Links. בלי הצהרה תקפה האפליקציה
נופלת חזרה למצב דפדפן (Custom Tab עם שורת כתובת).

`/.well-known/assetlinks.json` בשורש הריפו:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.gius.app",
    "sha256_cert_fingerprints": ["DA:61:B1:4D:...:FC:4C"]
  }
}]
```

**כללים:**
1. **`sha256_cert_fingerprints` חייב להיות זהה לטביעת האצבע של המפתח החותם** —
   זו שבטבלת החתימה למעלה. אלה שני צדדים של אותה הצהרה: המפתח שחותם על ה-APK
   והטביעה שהאתר מצהיר עליה. **מפתח שמשתנה מחייב עדכון של הקובץ הזה**, אחרת
   האימות נכשל וכל המשתמשים חוזרים למצב דפדפן.
2. **`package_name` חייב להיות `com.gius.app`** — זהה ל-Package ID של ה-APK.
3. **`.nojekyll` בשורש הריפו הוא תנאי הכרחי.** GitHub Pages מריץ Jekyll כברירת
   מחדל, ו-Jekyll **לא מגיש תיקיות שמתחילות בנקודה** — בלי `.nojekyll` הקובץ
   פשוט יחזיר 404. הקובץ קיים בריפו; לא למחוק אותו.

**אימות אחרי פריסה:**
```bash
curl -i https://ygtotlrl-lab.github.io/gius/.well-known/assetlinks.json
```
צריך להחזיר `200` ו-JSON תקין.

> **הערה שדורשת בדיקה בשטח:** אנדרואיד מושך את רשימת ההצהרות מ**שורש ה-origin** —
> `https://ygtotlrl-lab.github.io/.well-known/assetlinks.json` — ולא מתת-הנתיב
> `/gius/`. באתר Project Pages תת-הנתיב אינו שורש ה-origin, ולכן ייתכן שהקובץ
> הזה לבדו לא יספיק. אם אחרי הפריסה האפליקציה עדיין נפתחת כדפדפן: הפתרון הוא
> ריפו `ygtotlrl-lab.github.io` (User Pages) שמגיש `/.well-known/assetlinks.json`
> בשורש, עם מערך שמכיל הצהרה לכל אפליקציה בארגון (gius, yoman-avoda וכו').

---

## הרצת ה-migration

לא רץ אוטומטית. להריץ ידנית מול הפרויקט (SQL Editor או `supabase db push`):

```
migrations/0001_init.sql          ✅ הורץ ואומת
migrations/0002_revoke_delete.sql ✅ הורץ ואומת
```

שני הקבצים אידמפוטנטיים — אפשר להריץ שוב בבטחה. 0001 זורע את המשתמש הראשוני
(`mmf` / `770770`, מענדי פרידמן, owner) ואת רשימות הפתיחה, ותו לא.
0002 מסיר מ-`anon` את הרשאת ה-DELETE שנשארה לו (ר' סעיף 4).

**מצב המסד כרגע (אומת מול הפרויקט):** שבע טבלאות `g_`, RLS מופעל בכולן עם
policy אחת וטריגר `_touch` אחד לכל טבלה, ו-`anon` מחזיק `INSERT, SELECT,
UPDATE` בלבד. `g_users` שורה אחת (`mmf`), `g_config` שלוש שורות, שאר הטבלאות
ריקות.

**מיגרציות חדשות:** קובץ חדש ורץ קדימה בלבד (הבא בתור `0003_...sql`), אף פעם
לא עריכה של קובץ שכבר רץ. מיגרציה שמוסיפה טבלה חייבת לכלול `revoke all` ואז
`grant select, insert, update` — ר' המלכודת בסעיף 4.

---

## אייקונים

```bash
node scripts/gen-icons.mjs
```

מייצר את כל ה-PNG-ים מחישוב פיקסלים (ללא ספריות). לא לערוך את הקבצים ב-`icons/`
ידנית — לשנות את הסקריפט ולהריץ מחדש.
