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
-- ---------------------------------------------------------------------------
create table if not exists g_users (
  id          uuid primary key default gen_random_uuid(),
  username    text        not null unique,
  password    text        not null,
  full_name   text        not null,
  role        text        not null default 'manager'
                          check (role in ('owner', 'manager')),
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

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
    execute format('grant select, insert, update on table %I to anon, authenticated', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed — the initial owner and the editable lists.
-- Nothing else is seeded: the app ships empty of business data.
-- ---------------------------------------------------------------------------
insert into g_users (username, password, full_name, role, active)
values ('mmf', '770770', 'מענדי פרידמן', 'owner', true)
on conflict (username) do nothing;

insert into g_config (key, value) values
  ('categories', '["תרומה","גביה","מגביות","פרוייקטים","הוראות קבע","פרנסים ותאריכים"]'::jsonb),
  ('causes',     '[]'::jsonb),
  ('domains',    '["כספים","שימור תורמים","תשתיות","יעד יזום"]'::jsonb)
on conflict (key) do nothing;

commit;
