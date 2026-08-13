-- ============================================================================
-- gius — ניהול גיוס כספים
-- Migration 0001 — initial schema
--
-- Project ref : zrftjkghhjhqzopvdzou   (dedicated project, not shared)
-- Prefix      : g_
--
-- Design rules encoded here (see CLAUDE.md for the full contract):
--   1. Soft delete only. Every entity table carries deleted + deleted_at, and
--      the anon role is deliberately NOT granted DELETE — physical deletion is
--      impossible through the application.
--   2. Every row has updated_at, maintained by trigger. This is the basis for
--      a future merge engine, so it must be reliable server-side and not
--      depend on the client sending it.
--   3. g_txns.donor_id and g_pledges.donor_id reference g_donors
--      ON DELETE RESTRICT.
--   4. RLS is ENABLED on every table with fully open policies, plus explicit
--      GRANTs to anon. This is a conscious, documented decision: the app is an
--      internal tool with its own login table (g_users); authorization lives in
--      the application layer, not in Postgres. Anyone holding the anon key can
--      read and write all rows.
--   5. No stored computed money. "נגבה", "נותר" and pledge status are always
--      derived at runtime from g_txns.
--
-- Run this once against the project. It is idempotent.
--
-- ⛔ WHAT "IDEMPOTENT" HAS TO MEAN HERE (round 27)
--   `create table if not exists` SKIPS an existing table entirely. So a file
--   that only creates tables is idempotent in the trivial sense — running it
--   twice does no harm — and useless in the sense that matters: an older
--   installation that re-runs it does NOT receive any structural change made
--   after it was first created. It silently keeps a schema the running code
--   no longer matches.
--
--   Therefore: **every structural change made since the first install needs
--   its own convergence statement here**, next to the table it belongs to —
--   `add column if not exists`, `alter column … drop default`,
--   `create index if not exists`, `drop trigger if exists` + `create trigger`,
--   `drop policy if exists` + `create policy`, and an explicit `revoke` before
--   any `grant` (a GRANT is additive and can never take a privilege away).
--   ⛔ Never touch data. Structure only.
--
--   Convergence statements already here: `pass_salt`/`pass_fp` (0003),
--   `role drop default` (round 26 completion), and the `revoke all` in the
--   grants loop (0002). The upgrade migrations stay in the repo as the record
--   of what changed and why — this file is what makes a stale install catch up.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function g_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- g_users — application login accounts
--   Users are never deleted; `active` is their soft-delete.
--
-- ⛔ `role` has NO DEFAULT (round 26 completion). Creating a user without an
--    explicit role fails in the database, and that is the intended behaviour:
--    a role is a decision, never a value that falls out on its own. This is
--    now identical in all three user tables across the organisation —
--    `g_users`, `ys_users`, `sl_users` are each `text not null` with no
--    default. ⚠️ The values themselves are NOT shared and must not be
--    aligned: `owner`/`manager` here, `admin`/`user` in schar-limud,
--    `admin`/`senior`/`junior` in hanhala-ruchanit.
--    (The previous `default 'manager'` failed closed — it granted the lower
--    role — so this is a consistency fix, not a vulnerability fix.)
-- ---------------------------------------------------------------------------
create table if not exists g_users (
  id          uuid primary key default gen_random_uuid(),
  username    text        not null unique,
  password    text        not null,
  full_name   text        not null,
  role        text        not null
                          check (role in ('owner', 'manager')),
  active      boolean     not null default true,
  pass_salt   text,
  pass_fp     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Upgrade path for an installation created before the round-26 completion.
-- Idempotent, and a no-op on a fresh install: `create table` above already
-- declares the column without a default. ⚠️ Touches no data — it only removes
-- the column default, so existing rows keep the role they already hold.
alter table g_users alter column role drop default;

-- Upgrade path for an installation created before 0003_pass_fp.sql (round 23).
-- PBKDF2-SHA256 fingerprint (100k rounds, per-user random salt) that makes
-- offline login possible. ⛔ `password` is NOT touched: the fingerprint is
-- added ALONGSIDE it, never in place of it — that is a documented decision
-- (iron rule 9; see "מודל הסיסמאות" in CLAUDE.md). What reaches the device is
-- the fingerprint only; the password itself never does (`strip: ['password']`).
-- ⚠️ Without these two lines an existing install re-running this file would
--    keep a g_users with no fingerprint columns, and offline login would fail
--    for every user with MSG_OFF_NO_FP — the exact silent drift this file's
--    header warns about.
alter table g_users add column if not exists pass_salt text;
alter table g_users add column if not exists pass_fp   text;

-- ---------------------------------------------------------------------------
-- g_donors — תורמים
-- ---------------------------------------------------------------------------
create table if not exists g_donors (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  phone       text,
  agent       text,                                   -- שגריר
  is_vip      boolean     not null default false,
  notes       text,
  tags        text[]      not null default '{}',
  deleted     boolean     not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- g_pledges — התחייבויות
--   No collected/remaining columns on purpose: both are derived from g_txns.
-- ---------------------------------------------------------------------------
create table if not exists g_pledges (
  id          uuid primary key default gen_random_uuid(),
  donor_id    uuid        not null references g_donors (id) on delete restrict,
  amount      numeric(14,2) not null default 0,
  cause       text,                                   -- עילה
  agent       text,                                   -- שגריר
  note        text,
  due_date    date,
  deleted     boolean     not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- g_txns — תנועות
--   pledge_id is nullable: a transaction may stand on its own.
-- ---------------------------------------------------------------------------
create table if not exists g_txns (
  id          uuid primary key default gen_random_uuid(),
  donor_id    uuid        not null references g_donors (id)  on delete restrict,
  pledge_id   uuid            null references g_pledges (id) on delete restrict,
  amount      numeric(14,2) not null default 0,
  txn_date    date        not null default current_date,
  category    text,                                   -- סעיף
  agent       text,                                   -- שגריר
  manager     text,                                   -- מנהל מטפל
  cleared     boolean     not null default true,      -- נפרע
  note        text,
  deleted     boolean     not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- g_tasks — משימות (קנבן)
-- ---------------------------------------------------------------------------
create table if not exists g_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  stage       text        not null default 'הכנה'
                          check (stage in ('הכנה', 'הרצה', 'השלמה', 'חסומה')),
  assignee    text,
  domain      text,                                   -- תחום
  due_date    date,
  log         text        not null default '',        -- יומן מצטבר
  deleted     boolean     not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- g_targets — יעד חודשי
-- ---------------------------------------------------------------------------
create table if not exists g_targets (
  id          uuid primary key default gen_random_uuid(),
  month       text        not null unique
                          check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount      numeric(14,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- g_config — רשימות הניתנות לעריכה (סעיפים, עילות, תחומים)
--   value is a JSON array of strings; the whole array is replaced on save.
-- ---------------------------------------------------------------------------
create table if not exists g_config (
  key         text primary key,
  value       jsonb       not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists g_donors_live_idx   on g_donors  (deleted, name);
create index if not exists g_pledges_donor_idx on g_pledges (donor_id) where deleted = false;
create index if not exists g_pledges_live_idx  on g_pledges (deleted, due_date);
create index if not exists g_txns_donor_idx    on g_txns    (donor_id)  where deleted = false;
create index if not exists g_txns_pledge_idx   on g_txns    (pledge_id) where deleted = false;
create index if not exists g_txns_date_idx     on g_txns    (deleted, txn_date);
create index if not exists g_tasks_stage_idx   on g_tasks   (deleted, stage);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['g_users','g_donors','g_pledges','g_txns','g_tasks','g_targets','g_config']
  loop
    execute format('drop trigger if exists %I on %I', t || '_touch', t);
    execute format(
      'create trigger %I before update on %I for each row execute function g_touch_updated_at()',
      t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS + GRANTs
--   Open policies by design (internal tool). DELETE is intentionally withheld
--   from anon so that soft-delete cannot be bypassed from the client.
--
-- ⛔ THE `revoke all` IS LOAD-BEARING — do not "simplify" it away (0002).
--   A GRANT is additive only: it can add a privilege, never remove one. A stock
--   Supabase project ships with
--       alter default privileges in schema public
--         grant all on tables to anon, authenticated, service_role;
--   so every table created above is BORN with DELETE and TRUNCATE for anon, and
--   the `grant select, insert, update` below does not take them back. That was
--   measured on the live project after the first run of this file: anon held
--   DELETE and TRUNCATE on all seven tables while the soft-delete rule was
--   documented as enforced. `migrations/0002_revoke_delete.sql` fixed the live
--   database; the revoke here is what keeps a re-run of this file from being a
--   no-op on that point.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['g_users','g_donors','g_pledges','g_txns','g_tasks','g_targets','g_config']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_open', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
      t || '_open', t);
    execute format('revoke all on table %I from anon, authenticated', t);
    execute format('grant select, insert, update on table %I to anon, authenticated', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

-- Keep a table added by a FUTURE migration from inheriting DELETE as well (0002).
-- ⚠️ ALTER DEFAULT PRIVILEGES only affects defaults owned by the role running
--    it. If Supabase's defaults were set by another role this is a no-op, and a
--    new table still needs its own `revoke all` — see the trap in CLAUDE.md §4.
alter default privileges in schema public
  revoke delete, truncate on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed — the editable lists only.
-- Nothing else is seeded: the app ships empty of business data.
--
-- ⛔ NO USER IS SEEDED HERE, AND NONE MAY BE ADDED.
-- Until round 24 this file carried an `insert into g_users` with a REAL
-- owner username and password written in plain text — in a PUBLIC repo.
-- Anyone who ever read this file (or its git history) holds that login,
-- against a database whose RLS policy is `using (true)` and whose anon key
-- ships inside index.html.
--
-- Create the first user MANUALLY in the Supabase SQL editor, with a password
-- that has never been committed anywhere:
--
--     insert into g_users (username, password, full_name, role, active)
--     values ('<username>', '<six digits>', '<full name>', 'owner', true)
--     on conflict (username) do nothing;
--
-- ⛔ Never seed credentials — username, password, or key — in any file that
--    is pushed to git. Deleting them later does NOT remove them: they stay
--    readable in the repository history forever. See iron rule 8.
--
-- ⚠️ The existing production database already holds its owner row; this
--    change does not touch it. Any password that was ever committed to this
--    repo must be treated as compromised and rotated.
-- ---------------------------------------------------------------------------
insert into g_config (key, value) values
  ('categories', '["תרומה","גביה","מגביות","פרוייקטים","הוראות קבע","פרנסים ותאריכים"]'::jsonb),
  ('causes',     '[]'::jsonb),
  ('domains',    '["כספים","שימור תורמים","תשתיות","יעד יזום"]'::jsonb)
on conflict (key) do nothing;

commit;
