-- ==========================================================================
-- 025_rename_g_config_to_g_settings.sql — שם הטבלה נגזר מתפקידה
-- ==========================================================================
--
-- ⛔ **רצה במסד** — ⚠️ הוחלה בסבב 148 ואומתה: אפס אובייקט בשם `g_config`,
--    ואפס מפתח גיבוי שנוקב בו.
--
-- ⛔ טבלת ההגדרות היא אותה טבלה בדיוק בכל חמש האפליקציות — ⚠️ אותן
--    עמודות, באותו סדר, ואותו תפקיד: ⭐ ובארבע היא `<תחילית>_settings`,
--    ⛔ וכאן לבדה היא נקראה `g_config`.
-- ⚠️ ו«גיוס» נבנתה ראשונה מבין השתיים שבפרויקט הזה, ⛔ ולא היה תקן שם:
--    ⭐ שני שמות לאותו תפקיד מכריחים כל קורא לזכור איזה שם שייך לאיזו
--    אפליקציה, ⛔ ואין מי שיצליב ביניהם.
--
-- ⚠️ **מה נמדד לפני ההרצה**: אפס מפתח זר שמצביע לטבלה · אפס טריגר ·
--    אפס תצוגה · **2** אובייקטים בשם (הטבלה ו-`g_config_pkey`) ·
--    **2** אילוצים · **1** policy · **11** רשומות ב-`sh_backup`
--    (`g_config` ×7 · `ANCHOR:g_config` ×4), ⛔ שהן **מפתח טקסט ולא מבנה**.
--
-- ⛔⛔ **והפונקציה `bk_retention_keys()` נוקבת בשם** — ⚠️ וזה מה שנמדד
--    ולא נמסר: ⭐ `bk_retention_sweep` מפנה ב-`key = any(v_keys)`, התאמה
--    מדויקת, ⛔ ורשימה שנשארה על השם הישן הייתה מקפיאה את שבעת עותקי
--    הגיבוי לנצח — ⚠️ בדיוק הכיוון ההפוך ממה שנראה במבט ראשון: ⛔ הפינוי
--    גורע מפתחות **שברשימה**, ⛔ ומפתח שאינו בה אינו מתפנה לעולם.
-- ⚠️ ושכבת `ANCHOR:` אינה ברשימה השמית — ⭐ `bk_prune_layer` מפנה אותה
--    בתבנית (`key like 'ANCHOR:%'`), ⛔ והשם שבתוכה אינו משנה לה.
--
-- ⛔ **והכול בעסקה אחת** — ⚠️ שם טבלה שהוסב בלי שמפתחות הגיבוי הוסבו
--    איתו הוא שחזור שאינו מוצא את עוגניו.
--
-- ⛔ אידמפוטנטי: כל צעד מותנה בקיום השם הישן — ⚠️ הרצה שנייה אינה
--    משנה דבר ⛔ ואינה נופלת.
-- ⚠️ **וההיפוך הוא שורה אחת** — `alter table public.g_settings rename to g_config;`
--    ⛔ ואחריה אותם צעדים בכיוון ההפוך.
-- ==========================================================================

begin;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. הטבלה
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname = 'g_config' and c.relkind = 'r') then
    alter table public.g_config rename to g_settings;
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. האילוצים — ⛔ ושם המפתח הראשי גורר איתו את האינדקס התומך
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'g_config_pkey'
              and conrelid = 'public.g_settings'::regclass) then
    alter table public.g_settings rename constraint g_config_pkey to g_settings_pkey;
  end if;
  if exists (select 1 from pg_constraint where conname = 'g_config_value_json'
              and conrelid = 'public.g_settings'::regclass) then
    alter table public.g_settings rename constraint g_config_value_json to g_settings_value_json;
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. ה-policy
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_policy pol join pg_class c on c.oid = pol.polrelid
              where c.relname = 'g_settings' and pol.polname = 'g_config_open') then
    alter policy g_config_open on public.g_settings rename to g_settings_open;
  end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. מפתחות הגיבוי — ⛔ טקסט, ולא מבנה
-- ───────────────────────────────────────────────────────────────────────────
update public.sh_backup
   set key = replace(key, 'g_config', 'g_settings')
 where key like '%g_config%';


-- ───────────────────────────────────────────────────────────────────────────
-- 5. רשימת-ההיתר של הפינוי — ⛔ בלעדיה שבעת העותקים אינם מתפנים לעולם
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.bk_retention_keys()
returns text[]
language sql
immutable
as $function$
  select array[
    'g_donors', 'g_pledges', 'g_txns', 'g_tasks',
    'g_targets', 'g_settings', 'g_users',
    'kp_settings', 'kp_years', 'kp_months', 'kp_standing_orders',
    'kp_so_instances', 'kp_entries', 'kp_lookups'
  ]::text[];
$function$;

commit;
