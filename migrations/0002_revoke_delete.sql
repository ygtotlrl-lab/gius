-- ============================================================================
-- gius — Migration 0002
-- Actually withhold DELETE from anon.
--
-- Why this exists:
--   0001 ran `grant select, insert, update` on every g_ table and treated that
--   as "anon cannot DELETE". It isn't. A GRANT is additive — it can only add
--   privileges, never remove them — and a stock Supabase project already ships
--   with
--       alter default privileges in schema public
--         grant all on tables to anon, authenticated, service_role;
--   so every table created by 0001 was born with DELETE and TRUNCATE for anon.
--   Verified against the live project after 0001 ran: anon held
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on all seven
--   tables. The soft-delete rule was documented but not enforced.
--
--   The application never issues a DELETE (every removal is a soft delete, and
--   the two upserts need only INSERT + UPDATE), so revoking is safe.
--
-- Idempotent — safe to run more than once.
-- ============================================================================

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

-- Keep future tables in this schema from inheriting DELETE as well.
-- Note: ALTER DEFAULT PRIVILEGES only touches defaults owned by the role that
-- runs it. If Supabase's defaults were set by a different role, this statement
-- is a no-op and any *new* table will need the revoke above applied to it too.
alter default privileges in schema public
  revoke delete, truncate on tables from anon, authenticated;

commit;

-- Verify:
--   select table_name,
--          string_agg(distinct privilege_type, ', ' order by privilege_type)
--   from information_schema.role_table_grants
--   where grantee = 'anon' and table_schema = 'public' and table_name like 'g\_%'
--   group by table_name order by table_name;
-- Expect exactly: INSERT, SELECT, UPDATE
