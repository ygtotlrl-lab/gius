-- ============================================================================
-- 002_revoke_delete.sql — Migration 0002
-- ============================================================================
--
-- ⛔ **רץ במסד.** ⛔ מיגרציה שכבר רצה אינה נערכת — ⚠️ המסד החיל אותה,
--    ועריכה שלה יוצרת מצב שבו הקובץ מתאר משהו אחר ממה שרץ; ⛔ שינוי מבני
--    נעשה בקובץ הבא בתור.

begin;

do $$
declare t text;
begin
  foreach t in array array['g_users','g_donors','g_pledges','g_txns','g_tasks','g_targets','g_config']
  loop
    execute format('revoke all on table %I from anon, authenticated', t);
    execute format('grant select, insert, update on table %I to anon, authenticated', t);
  end loop;
end $$;

-- ⛔ גם טבלה עתידית בסכימה הזו לא תירש `delete` — ⚠️ ירושה שקטה אין לה סימן.
-- ⚠️ `alter default privileges` נוגע רק בברירות מחדל שבבעלות התפקיד שמריץ
--    אותו. אם ברירות המחדל נקבעו ע"י תפקיד אחר — זהו no-op, ⛔ וכל טבלה
--    חדשה תזדקק ל-`revoke` שלמעלה בעצמה.
alter default privileges in schema public
  revoke delete, truncate on tables from anon, authenticated;

commit;

-- אימות:
--   select table_name,
--          string_agg(distinct privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where grantee = 'anon' and table_schema = 'public' and table_name like 'g\_%'
--   group by table_name order by table_name;
-- Expect exactly: INSERT, SELECT, UPDATE
