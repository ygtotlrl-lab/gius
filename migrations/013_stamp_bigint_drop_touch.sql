-- ============================================================================
-- 013_stamp_bigint_drop_touch.sql — החותמת היא `bigint` של המכשיר
-- ============================================================================
--
-- ⛔ **רץ במסד.**
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ מסיר את שבעת טריגרי ה-`touch` שבצד השרת,
--    ⛔ וממיר את `updated_at` מ-`timestamptz` ל-`bigint` — ⭐ מילישניות
--    מאז העידן, בדיוק מה ש-`Date.now()` מייצר.
--
-- ⛔⛔ **הנימוק — והוא היפוך של החלטה קודמת:** ⚠️ עד כאן נכתב שהחותמת
--    בטריגר «כי היא הבסיס למנוע המיזוג ולכן חייבת להיות אמינה». ⭐ המדידה
--    הפוכה: ⛔ חותמת שרת אינה אומרת **מתי נערך** אלא **מתי הגיע**, ⚠️ ולכן
--    מכשיר שערך אופליין ודחף מאוחר נראה חדש יותר מעריכה שקדמה לו —
--    ⛔ ודורס אותה. ⭐ החותמת האמינה היא של המכשיר שערך.
--
-- ⚠️ **ואין `default`** — ⛔ ולא `now()` במילישניות: ⭐ ברירת מחדל בצד השרת
--    היא מקור חותמת שני שמתמלא בשקט כשהקוד שוכח. ⚠️ `not null` בלי ברירה
--    מפיל כתיבה כזו ברעש, ⛔ וזה הרצוי.
--
-- ⚠️ **`created_at` ו-`deleted_at` נשארים `timestamptz`** — ⛔ הם אינם
--    חותמות מיזוג: ⭐ איש אינו מכריע לפיהם, ⛔ והם נקראים בעיני אדם.
--
-- ⛔ **נמדד לפני ההמרה:** ⚠️ 3 · 1 · 0 · 1 · 0 · 1 · 1 שורות בשבע.
-- ============================================================================

drop trigger if exists g_config_touch  on public.g_config;
drop trigger if exists g_donors_touch  on public.g_donors;
drop trigger if exists g_pledges_touch on public.g_pledges;
drop trigger if exists g_targets_touch on public.g_targets;
drop trigger if exists g_tasks_touch   on public.g_tasks;
drop trigger if exists g_txns_touch    on public.g_txns;
drop trigger if exists g_users_touch   on public.g_users;

drop function if exists public.g_touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['g_config','g_donors','g_pledges','g_targets',
                           'g_tasks','g_txns','g_users'] loop
    if (select data_type from information_schema.columns
          where table_schema = 'public' and table_name = t
            and column_name = 'updated_at') is distinct from 'bigint' then
      execute format('alter table public.%I alter column updated_at drop default', t);
      execute format('alter table public.%I alter column updated_at type bigint '
                     'using (extract(epoch from updated_at) * 1000)::bigint', t);
    end if;
  end loop;
end $$;
