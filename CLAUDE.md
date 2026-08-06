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
icons/                     אייקונים (נוצרים ע"י scripts/gen-icons.mjs — לא לערוך ידנית)
migrations/0001_init.sql   סכמת הבסיס. להריץ ידנית מול הפרויקט.
scripts/check-js.mjs       שער חובה לפני כל push
scripts/gen-icons.mjs      מחולל האייקונים
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

`CACHE_NAME = 'gius-v1'`. **להעלות את המספר בכל שחרור** שמשנה נכסים.

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

## הרצת ה-migration

לא רץ אוטומטית. להריץ ידנית מול הפרויקט (SQL Editor או `supabase db push`):

```
migrations/0001_init.sql          ✅ הורץ
migrations/0002_revoke_delete.sql ⏳ ממתין להרצה
```

שני הקבצים אידמפוטנטיים — אפשר להריץ שוב בבטחה. 0001 זורע את המשתמש הראשוני
(`mmf` / `770770`, מענדי פרידמן, owner) ואת רשימות הפתיחה, ותו לא.
0002 מסיר מ-`anon` את הרשאת ה-DELETE שנשארה לו (ר' סעיף 4).

**מיגרציות חדשות:** קובץ חדש ורץ קדימה בלבד (`0002_...sql`), אף פעם לא עריכה
של קובץ שכבר רץ.

---

## אייקונים

```bash
node scripts/gen-icons.mjs
```

מייצר את כל ה-PNG-ים מחישוב פיקסלים (ללא ספריות). לא לערוך את הקבצים ב-`icons/`
ידנית — לשנות את הסקריפט ולהריץ מחדש.
