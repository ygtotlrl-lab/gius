-- ============================================================================
-- 016_config_shape_and_targets_soft_delete.sql — צורת ההגדרות ומחיקה רכה
-- ============================================================================
--
-- ⛔ **רץ במסד.**
--
-- ⛔⛔ **א · `g_config` בצורת טבלת ההגדרות המשותפת:** ⚠️ `value` הופך
--    מ-`jsonb` ל-`text`, ⛔ ונוספות `client_id` ושלישיית המחיקה הרכה.
--    ⭐ **הנימוק:** ⛔ ארבע טבלאות הגדרות בארבע צורות אינן ניתנות להצלבה,
--    ⚠️ ו-`jsonb` בצד השרת הוא **מנתח שני** לאותו ערך: ⭐ הלקוח כבר
--    ממיר את הערך בעצמו, ⛔ ושני ממירים נסחפים זה מזה בשקט.
--    ⚠️ **וההמרה שומרת את הערך** — ⛔ `value::text` על `jsonb` מייצר בדיוק
--    את מה ש-`JSON.stringify` מייצר, ⭐ ולכן `JSON.parse` בצד השני מחזיר
--    את אותו ערך.
--
-- ⛔⛔ **ב · `g_targets` מקבלת מחיקה רכה:** ⚠️ `deleted` · `deleted_at` ·
--    `deleted_by` — ⭐ שלוש עמודות, כמו בכל טבלה שנושאת מחיקה: ⛔ טבלה
--    שאין בה מחיקה רכה נמחקת פיזית או אינה נמחקת כלל, ⚠️ ובשתי הדרכים
--    מחיקה שנעשתה במכשיר אחד אינה מגיעה לשני.
--
-- ⛔ **נמדד לפני השינוי:** ⚠️ 3 שורות ב-`g_config` · שורה אחת ב-`g_targets`.
-- ============================================================================

alter table public.g_config add column if not exists client_id  text;
alter table public.g_config add column if not exists deleted    boolean not null default false;
alter table public.g_config add column if not exists deleted_at timestamptz;
alter table public.g_config add column if not exists deleted_by text;

do $$
begin
  if (select data_type from information_schema.columns
        where table_schema = 'public' and table_name = 'g_config'
          and column_name = 'value') is distinct from 'text' then
    alter table public.g_config alter column value drop default;
    alter table public.g_config alter column value type text using value::text;
    alter table public.g_config alter column value set default '[]';
  end if;
end $$;

alter table public.g_targets add column if not exists deleted    boolean not null default false;
alter table public.g_targets add column if not exists deleted_at timestamptz;
alter table public.g_targets add column if not exists deleted_by text;
