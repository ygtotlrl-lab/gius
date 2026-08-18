-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 — `g_users`: עמודת `deleted`
-- ═══════════════════════════════════════════════════════════════════════════
-- ⛔ נכתבה ולא הורצה (סבב 37) — ההרצה היא החלטת המנהל.
--
-- ⭐ **הדפוס נקבע ב-2026-08-18** כשהמנהל הריץ את
--    `schar_013_users_active_updated_deleted` בפרויקט המשותף: טבלת משתמשים
--    בארגון נושאת `active` · `updated_at` · `deleted`.
--
-- מה שנמדד כאן מול המסד החי ב-2026-08-18:
--   קיים:  active (boolean, not null, default true) · updated_at
--          (timestamptz, not null, default now()) · טריגר `g_users_touch`
--   חסר:   deleted
-- כלומר `g_users` הייתה **הקרובה ביותר לדפוס משלוש הטבלאות**, ומכאן
-- שהעמודה היחידה שנוספת כאן היא `deleted`.
--
-- ⚠️ **וזו תוספת מבנית בלבד — היא אינה משנה את מודל המחיקה כאן.** כלל
--    קריטי 4 קובע ש«משתמשים הם החריג: הם לא נמחקים אף פעם, השדה `active`
--    הוא המחיקה הרכה שלהם», והכלל הזה **לא השתנה**: אף מסלול בקוד אינו
--    קורא `deleted` ואינו כותב אותה. ⛔ אין להוסיף לה קוראים בלי הכרעה
--    נפרדת — שני שדות שמתארים «המשתמש הוסר» הם שני מקורות אמת.
-- ⛔ `0001_init.sql` **לא נגע** — כאן מיגרציות רצות קדימה בלבד, ואין
--    עריכה של קובץ שכבר רץ.
-- ⛔ אין נגיעה בנתונים — ה-`UPDATE` היחיד ממלא עמודה שזה עתה נוספה.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.g_users add column if not exists deleted boolean;
update public.g_users set deleted = false where deleted is null;
alter table public.g_users alter column deleted set default false;
alter table public.g_users alter column deleted set not null;

-- ---------- הרשאות ----------
-- ⛔ REVOKE לפני GRANT, ואין לקצר (כלל ברזל 10 סעיף 9) — GRANT הוא אדיטיבי.
--    (0002 כבר צמצם את שבע הטבלאות ואומת בסבב 29; החזרה כאן היא שורת
--    התכנסות, לא שינוי.)
revoke all on public.g_users from anon, authenticated;
grant select, insert, update on public.g_users to anon, authenticated;

-- ---------- אימות ----------
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='g_users' and column_name='deleted';
-- מצופה: deleted boolean NO false
