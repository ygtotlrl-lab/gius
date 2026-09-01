-- ============================================================================
-- 004_backup_log.sql — גיבוי יומי ויומן פעולות
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.
--
-- gius הייתה האפליקציה היחידה בארגון **בלי גיבוי ובלי יומן פעולות**: שתי
-- הטבלאות `kv_backup` ו-`sync_log` קיימות רק בפרויקט המשותף
-- (`kxbtskqobynewvnckaaz`), שבו חיות hanhala-ruchanit, schar-limud
-- ו-yoman-avoda. gius חיה בפרויקט **נפרד** (`zrftjkghhjhqzopvdzou`), ולכן
-- אין לה גישה אליהן והן נוצרות כאן.
--
-- ⚠️ הסכימה כאן **זהה בית-לבית** לזו שבפרויקט המשותף (הועתקה מ-
--    `hanhala-ruchanit/migrations/000_initial_schema.sql`, סעיפים 3 ו-4,
-- ואומתה מול `information_schema` של הפרויקט המשותף). שם הטבלה,
--    שמות העמודות והטיפוסים זהים — וזה מה שמאפשר לגוף מודול הגיבוי ב-
--    `index.html` להיות זהה בית-לבית בארבע האפליקציות.
--    ⛔ אין «לשפר» כאן את המבנה: מבנה שנבדל היה מחייב מודול שנבדל.
--
-- ⛔ אידמפוטנטית ואינה נוגעת בנתונים — `create table if not exists`,
--    `drop policy if exists` + `create policy`, ו-`revoke`+`grant` מפורשים
--    (כלל ברזל 10 סעיף 7). אין בקובץ אף `insert`, `update` או `delete`.
--
-- ⛔ אין כאן משתמש, סיסמה או תפקיד — גם לא «לדוגמה» (כלל ברזל 10 סעיף 8).
-- ============================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- 1. sync_log — יומן פעולות
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ יומן בלבד — האפליקציה כותבת אליו ואינה קוראת ממנו במסלול חי.
create table if not exists public.sync_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz default now(),
  device_id    text,
  user_name    text,
  action       text,
  key          text,
  record_count integer,
  details      jsonb
);

alter table public.sync_log enable row level security;
drop policy if exists sync_log_insert on public.sync_log;
drop policy if exists sync_log_select on public.sync_log;
create policy sync_log_insert on public.sync_log for insert to anon with check (true);
create policy sync_log_select on public.sync_log for select to anon using (true);

-- ⛔ **יומן ראיות — `insert`+`select` בלבד, לשני התפקידים** (כלל ברזל 10
-- סעיף 9): מי שאינו יכול לעדכן אינו יכול לזייף רישום קיים, ומי
--    שאינו יכול למחוק אינו יכול להעלים אותו. ⛔ אין «ליישר» את הטבלה הזו
--    לשאר טבלאות ה-`g_` בשם האחידות — הסט הצר **הוא** ההגנה.
-- ⚠️ הסדר `revoke` ואז `grant` הוא מה שעובד: `GRANT` אדיטיבי ואינו מסיר
--    דבר, ופרויקט Supabase סטנדרטי מעניק `all` בברירת המחדל (המלכודת
--    שמתועדת בסעיף 4 של כללי הברזל ב-CLAUDE.md).
revoke all on public.sync_log from anon, authenticated;
grant insert, select on public.sync_log to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.sync_log to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. kv_backup — גיבוי יומי
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ `bkMaybeDaily` שב-`index.html` כותבת לכאן פעם ביממה, **ורק אחרי שכל
--    המקורות גובו בהצלחה** נכתב הדגל המקומי. הערך הוא `JSON.stringify` של
--    תוצאת `select` על הטבלה, כמחרוזת — בדיוק כמו בפרויקט המשותף.
-- ⛔ `g_users` נגבית בעמודות מפורשות ולא ב-`*` — הטבלה הזו קריאה
--    ל-`anon`, וגיבוי גורף של טבלת המשתמשים היה מעתיק לכאן את `password`
--    בטקסט גלוי ואת `pass_salt`/`pass_fp`. ר' `BK_CFG` ב-`index.html`.
create table if not exists public.kv_backup (
  id         bigint generated always as identity primary key,
  created_at timestamptz default now(),
  key        text,
  value      text
);

alter table public.kv_backup enable row level security;
drop policy if exists kv_backup_insert on public.kv_backup;
drop policy if exists kv_backup_select on public.kv_backup;
create policy kv_backup_insert on public.kv_backup for insert to anon with check (true);
create policy kv_backup_select on public.kv_backup for select to anon using (true);

-- ⛔ אותו דפוס כמו ב-`sync_log` שלמעלה — ⚠️ ומאותה סיבה: יומן ראיות
--    שאפשר למחוק ממנו אינו ראיה.
revoke all on public.kv_backup from anon, authenticated;
grant insert, select on public.kv_backup to anon, authenticated;
grant select, insert, update, delete, truncate, references, trigger
  on public.kv_backup to service_role;


-- ⚠️ אינדקס לשליפת הגיבוי האחרון של מפתח — היחיד שנשלף בפועל כשמשחזרים.
create index if not exists kv_backup_key_created_idx
  on public.kv_backup (key, created_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- 3. טבלה עתידית — התזכורת שאין לוותר עליה
-- ───────────────────────────────────────────────────────────────────────────
-- ⛔ **כל מיגרציה שמוסיפה טבלה חייבת `revoke` משלה** (כלל ברזל 10 סעיף 9).
--    `alter default privileges` שב-`0002` מקטין את הסיכון ואינו מבטל את
--    הכלל — הוא משפיע רק על ברירות מחדל שבבעלות התפקיד שמריץ אותו.
