-- ============================================================================
-- 0005_backup_retention_cron.sql — פינוי אוטומטי ל-kv_backup דרך pg_cron
-- (סבב 35ג) · הפרויקט של gius `zrftjkghhjhqzopvdzou`
-- ============================================================================
-- ⛔ **הקובץ הזה לא הורץ.** הוא נכתב בסבב 35ג ונמסר להרצה ידנית ע"י המנהל
--    (ר' «גישת Supabase» ב-CLAUDE.md). ⛔ אין להריץ אותו מתוך סשן.
--
-- ⚠️ gius חיה בפרויקט **נפרד**, ולכן `kv_backup` ו-`sync_log` שלה הן טבלאות
--    אחרות מאלה שבפרויקט המשותף (`migrations/0004_backup_log.sql`). המקבילה
--    לקובץ הזה בפרויקט המשותף היא
--    `hanhala-ruchanit/migrations/004_backup_retention_cron.sql` — **מבנה
--    זהה, רשימת-היתר אחרת**, בדיוק כפי שסכימת שתי הטבלאות זהה בית-לבית.
--
-- ⭐ **למה במסד ולא בקוד** (סבב 35ג): מדיניות השמירה נכתבה למודול הגיבוי
--    בהשלמת סבב 35 והיא **דרוכה אך אינה יכולה לרוץ** — ל-`kv_backup` יש
--    `insert`+`select` בלבד לשני התפקידים (כלל ברזל 10 סעיף 9), ו⛔ אין
--    לפתוח לה `delete` ל-`anon`. המשימה המתוזמנת רצה **בתוך המסד**,
--    בהרשאות פנימיות, ואינה נוגעת בהרשאות האפליקציה.
--
-- ⚠️ **שתי השכבות מכוונות, ואינן כפילות** (סבב 35ג): המסד מפנה, והלקוח
--    **לא יכול ולא צריך**. `_bkRetention` שבמודול המשותף נשארת שכבה
--    שנכשלת-סגור — מנסה, נדחית, ומדלגת בשקט בלי להפיל את הגיבוי.
--    ⛔ אין להסיר אותה מהקוד (סבב 35ג).
--
-- ⛔ אידמפוטנטי לחלוטין: `create extension if not exists`,
--    `create or replace function`, ו-`unschedule` לפני `schedule` מחדש.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. התוסף
-- ────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. רשימת-ההיתר — מפתחות הגיבוי היומי, במפורש
-- ────────────────────────────────────────────────────────────────────────────
-- ⛔⛔ **רשימת-היתר מפורשת ולא קידומת** (סבב 35ג) — קידומת (`like 'g\_%'`,
--     ובוודאי קידומת ריקה) הייתה תופסת גם גיבויים חד-פעמיים. הרשימה כאן
--     היא **אותה רשימה מבנית שבמודול** — `BK_CFG.sources()` של gius, שבע
--     הטבלאות, בלי קידומת (`prefix: ''`).
--
-- ⛔ **מפתח שאינו ברשימה אינו נמחק לעולם** — וזה כולל, במפורש:
--    `PRE_SYNC_UNIFY_*` · `PRE_ROUND3B_*` · `ORPHAN_*` · `pre-delete-*`.
create or replace function public.bk_retention_keys()
returns text[]
language sql
immutable
as $$
  select array[
    'g_donors', 'g_pledges', 'g_txns', 'g_tasks',
    'g_targets', 'g_config', 'g_users'
  ]::text[];
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. הגריעה עצמה — 30 יום, רשימת-היתר, ובדיקות שפיות שמסרבות לרוץ
-- ────────────────────────────────────────────────────────────────────────────
-- ⛔ **שתי בדיקות שפיות שמסרבות לרוץ** (סבב 35ג) — פונקציה שמוחקת נתוני
--    גיבוי חייבת להיכשל ברעש ולא למחוק «לפי מה שיש»:
--      א. רשימת-היתר ריקה או `null` ⇒ `raise exception`.
--      ב. מפתח מוגן שנכנס לרשימה בטעות ⇒ `raise exception` — הגנה כפולה על
--         `PRE_*`/`ORPHAN_*`, שאין להם עותק אחר.
-- ⚠️ `security definer` — הפונקציה רצה בהרשאות הבעלים כדי שתוכל למחוק
--    מטבלה שלשני התפקידים אין בה `delete`. ⛔ ולכן סעיף 5 מסיר ממנה את
--    הרשאת ההרצה מ-`anon`/`authenticated`.
create or replace function public.bk_retention_sweep(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys    text[] := public.bk_retention_keys();
  v_deleted integer := 0;
begin
  if v_keys is null or cardinality(v_keys) = 0 then
    raise exception 'bk_retention_sweep: רשימת-ההיתר ריקה — מסרב לרוץ';
  end if;

  if exists (select 1 from unnest(v_keys) k
              where k like 'PRE\_%' or k like 'ORPHAN\_%' or k like 'pre-delete-%') then
    raise exception 'bk_retention_sweep: רשימת-ההיתר מכילה מפתח מוגן — מסרב לרוץ';
  end if;

  if p_days is null or p_days < 7 then
    raise exception 'bk_retention_sweep: חלון קצר מ-7 ימים — מסרב לרוץ';
  end if;

  delete from public.kv_backup
   where key = any (v_keys)
     and created_at < now() - make_interval(days => p_days);
  get diagnostics v_deleted = row_count;

  -- רישום ליומן הראיות — רק כשנמחק משהו בפועל (זהה להתנהגות המודול בקוד).
  if v_deleted > 0 then
    insert into public.sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_deleted,
            jsonb_build_object('days', p_days, 'keys', cardinality(v_keys)));
  end if;

  return v_deleted;
end;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. התזמון — יומי, בשעה שאינה מתנגשת עם הגיבוי
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ 03:17 UTC בכוונה (סבב 35ג): הדגל היומי של הגיבוי הוא תאריך **UTC**,
--    ולכן חצות UTC היא הרגע שבו כל המכשירים מתחילים לגבות. הגריעה נוגעת
--    ממילא רק בשורות בנות 30+ יום ולעולם לא בעותק שנכתב היום.
-- ⛔ `unschedule` לפני `schedule` (סבב 35ג) — מה שהופך את הקובץ לאידמפוטנטי
--    גם כשהשעה או הפקודה משתנות, ומונע שתי משימות שמריצות את אותה גריעה.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bk_retention_daily') then
    perform cron.unschedule('bk_retention_daily');
  end if;
end;
$$;

select cron.schedule(
  'bk_retention_daily',
  '17 3 * * *',
  $$select public.bk_retention_sweep(30);$$
);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. הרשאות — ⛔ הפונקציה אינה נגישה לאפליקציה
-- ────────────────────────────────────────────────────────────────────────────
-- ⛔ **בלי הסעיף הזה המיגרציה פותחת בדיוק את מה שהיא באה לסגור** (סבב 35ג):
--    כל פונקציה ב-`public` נגישה כ-RPC דרך PostgREST, ופונקציית
--    `security definer` שנגישה ל-`anon` היא נתיב מחיקה לכל מי שמחזיק את
--    המפתח הגלוי שב-`index.html`.
revoke all on function public.bk_retention_keys()           from public, anon, authenticated;
revoke all on function public.bk_retention_sweep(integer)    from public, anon, authenticated;
grant execute on function public.bk_retention_keys()         to service_role;
grant execute on function public.bk_retention_sweep(integer) to service_role;

-- ⛔ ו-`kv_backup` עצמה נשארת `insert`+`select` בלבד לשני התפקידים
--    (כלל ברזל 10 סעיף 9) — הקובץ הזה **אינו** מעניק לה `delete`.
