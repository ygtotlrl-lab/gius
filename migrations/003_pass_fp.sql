-- ============================================================================
--  0003_pass_fp.sql — טביעת סיסמה לכניסה אופליין (סבב 23)
-- ============================================================================
--
--  ⛔ **`password` לא נגע.** הסיסמה נשארת טקסט גלוי בענן, במכוון: המנהל
--  חייב לראות ולנהל סיסמאות מתוך «ניהול משתמשים», וזו החלטה מתועדת
--  (כלל ברזל 9; ר' «מודל הסיסמאות» ב-CLAUDE.md). שתי העמודות שכאן
--  **נוספות לצידה** ואינן מחליפות אותה — תפקידן היחיד הוא האימות המקומי
--  במכשיר, שם הסיסמה עצמה אינה נשמרת לעולם (`strip: ['password']`).
--
--  ⚠️ אל תסיקו מכאן שהמסד עבר להצפנה. הוא לא.
--
--  אדיטיבית ואידמפוטנטית — אפשר להריץ שוב בבטחה, ואינה נוגעת בנתונים
--  קיימים. עד שתורץ, האפליקציה ממשיכה לעבוד: השמירות נופלות-חזרה בלי
--  השדות (`gIsMissingFpCol`), וההשלמה מדלגת בשקט — אבל כניסה אופליין
--  למשתמש שאין לו טביעה לא תעבוד, כי אין ממה לגזור אותה.
--
--  אחרי ההרצה, כניסה מקוונת אחת של **בעלים** מפעילה את `gBackfillPassFp`
--  ומשלימה טביעות לכל המשתמשים הקיימים.
--
--  ⚠️ אין כאן `grant` חדש: ההרשאות ב-Postgres הן ברמת הטבלה, ו-`g_users`
--  כבר מחזיקה `select, insert, update` ל-`anon` מ-0002. עמודה חדשה
--  בטבלה קיימת יורשת אותן. (הכלל מ-CLAUDE.md — `revoke all` ואז
--  `grant select, insert, update` — חל על **טבלה חדשה**, ואין כאן כזו.)
-- ============================================================================

begin;

alter table g_users add column if not exists pass_salt text;
alter table g_users add column if not exists pass_fp   text;

commit;

-- Verify:
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'g_users'
--     and column_name in ('pass_salt', 'pass_fp');
-- Expect exactly two rows, both `text`.
--
--   select username, password is not null as has_pass,
--          pass_fp is not null as has_fp
--   from g_users order by created_at;
-- Expect `has_pass` true for all; `has_fp` false until an owner logs in
-- online once and the backfill runs.
