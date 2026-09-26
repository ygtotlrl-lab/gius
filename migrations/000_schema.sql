-- ═══ 000_schema.sql — גיוס: הסכימה החיה ════════════════════════════════

-- ─── משותף לפרויקט ─────────────────────────────────────────────────────

create extension if not exists pg_cron;

create table if not exists public.sh_backup (
  id bigint generated always as identity,
  created_at timestamp with time zone default now(),
  key text,
  value text,
  constraint sh_backup_pkey PRIMARY KEY (id)
);

create table if not exists public.sh_sync_log (
  id bigint generated always as identity,
  created_at timestamp with time zone default now(),
  device_id text,
  user_name text,
  action text,
  key text,
  record_count integer,
  details jsonb,
  constraint sh_sync_log_pkey PRIMARY KEY (id)
);

create index if not exists sh_backup_key_created_idx ON public.sh_backup USING btree (key, created_at DESC);

-- ⛔ revoke לפני grant — GRANT מוסיף ואינו מחליף, וטבלה חדשה ב-Supabase נולדת
--    עם DELETE ו-TRUNCATE ל-anon: המחיקה היא deleted=true, ולא DELETE.
-- ⚠️ יומן תוספת-בלבד — אין לו UPDATE: גיבוי ולוג נכתבים פעם אחת.
revoke all on table public.sh_backup from anon, authenticated;
grant select, insert on table public.sh_backup to anon, authenticated;
grant all on table public.sh_backup to service_role;
revoke all on table public.sh_sync_log from anon, authenticated;
grant select, insert on table public.sh_sync_log to anon, authenticated;
grant all on table public.sh_sync_log to service_role;
revoke all on sequence public.sh_backup_id_seq from anon, authenticated;
grant usage, select, update on sequence public.sh_backup_id_seq to anon, authenticated, service_role;
revoke all on sequence public.sh_sync_log_id_seq from anon, authenticated;
grant usage, select, update on sequence public.sh_sync_log_id_seq to anon, authenticated, service_role;

alter table public.sh_backup enable row level security;
drop policy if exists sh_backup_insert on public.sh_backup;
create policy sh_backup_insert on public.sh_backup as permissive for insert to anon, authenticated with check (true);
drop policy if exists sh_backup_select on public.sh_backup;
create policy sh_backup_select on public.sh_backup as permissive for select to anon, authenticated using (true);
alter table public.sh_sync_log enable row level security;
drop policy if exists sh_sync_log_insert on public.sh_sync_log;
create policy sh_sync_log_insert on public.sh_sync_log as permissive for insert to anon, authenticated with check (true);
drop policy if exists sh_sync_log_select on public.sh_sync_log;
create policy sh_sync_log_select on public.sh_sync_log as permissive for select to anon, authenticated using (true);

CREATE OR REPLACE FUNCTION public.bk_fn_def(p_name text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = p_name
     and p_name in ('bk_retention_keys', 'bk_retention_sweep', 'bk_prune_layer')
   limit 1;
$function$;
revoke all on function public.bk_fn_def(text) from public, anon, authenticated, service_role;
grant execute on function public.bk_fn_def(text) to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bk_prune_layer(p_prefix text, p_keep integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_deleted integer := 0;
begin
  if p_prefix is null or p_prefix not in ('ANCHOR:', 'DIFF:') then
    raise exception 'bk_prune_layer: תבנית שאינה מוכרת — %', p_prefix;
  end if;
  if p_keep is null or p_keep < 2 then
    raise exception 'bk_prune_layer: תקרה קטנה משניים — מסרב לרוץ';
  end if;
  with ranked as (
    select id, row_number() over (partition by key order by created_at desc) rn
      from public.sh_backup
     where key like p_prefix || '%'
  )
  delete from public.sh_backup b
   using ranked r
   where b.id = r.id and r.rn > p_keep;
  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    insert into public.sh_sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_deleted,
            jsonb_build_object('layer', p_prefix, 'keep', p_keep));
  end if;
  return v_deleted;
end;
$function$;
revoke all on function public.bk_prune_layer(text,integer) from public, anon, authenticated, service_role;
grant execute on function public.bk_prune_layer(text,integer) to service_role;

-- ⛔ רשימת-ההיתר היא בדיוק מפתחות הגיבוי שהקוד כותב — מפתח שאינו בה אינו מתפנה.
CREATE OR REPLACE FUNCTION public.bk_retention_keys()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select array[
    'g_donors', 'g_pledges', 'g_txns', 'g_tasks',
    'g_targets', 'g_settings', 'g_users',
    'k_settings', 'k_pledges', 'k_standing_orders',
    'k_so_instances', 'k_entries', 'k_lookups'
  ]::text[];
$function$;
revoke all on function public.bk_retention_keys() from public, anon, authenticated, service_role;
grant execute on function public.bk_retention_keys() to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bk_retention_sweep(p_days integer DEFAULT 30, p_keep integer DEFAULT 7)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_keys text[] := public.bk_retention_keys();
  v_age  integer := 0;
  v_cap  integer := 0;
begin
  if v_keys is null or cardinality(v_keys) = 0 then
    raise exception 'bk_retention_sweep: רשימת-ההיתר ריקה — מסרב לרוץ';
  end if;
  if p_days is null or p_days < 7 then
    raise exception 'bk_retention_sweep: חלון קצר מ-7 ימים — מסרב לרוץ';
  end if;
  if p_keep is null or p_keep < 1 then
    raise exception 'bk_retention_sweep: תקרת עותקים קטנה מ-1 — מסרב לרוץ';
  end if;

  delete from public.sh_backup
   where key = any (v_keys)
     and created_at < now() - make_interval(days => p_days);
  get diagnostics v_age = row_count;

  with ranked as (
    select id,
           row_number() over (partition by key
                              order by created_at desc, id desc) as rn
      from public.sh_backup
     where key = any (v_keys)
  )
  delete from public.sh_backup b
   using ranked r
   where b.id = r.id
     and r.rn > p_keep;
  get diagnostics v_cap = row_count;

  if (v_age + v_cap) > 0 then
    insert into public.sh_sync_log (device_id, user_name, action, key, record_count, details)
    values ('pg_cron', null, 'retention', null, v_age + v_cap,
            jsonb_build_object('days', p_days, 'keep', p_keep,
                               'keys', cardinality(v_keys), 'aged', v_age, 'capped', v_cap));
  end if;

  return v_age + v_cap;
end;
$function$;
revoke all on function public.bk_retention_sweep(integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.bk_retention_sweep(integer,integer) to service_role;

-- ⚠️ משימה לפי שמה — cron.schedule בשם קיים מעדכן אותה, ואינו מוסיף שנייה.
select cron.schedule('bk_prune_layers', '10 3 * * *', 'select public.bk_prune_layer(''ANCHOR:'', 4), public.bk_prune_layer(''DIFF:'', 30);');
select cron.schedule('bk_retention_daily', '0 3 * * *', 'select public.bk_retention_sweep(30, 7);');
select cron.schedule('sh_sync_log_retention', '20 3 * * *', 'delete from public.sh_sync_log where created_at < now() - interval ''30 days'';');

-- ─── גיוס ──────────────────────────────────────────────────────────────

create table if not exists public.g_donors (
  client_id text not null,
  name text not null,
  phone text,
  agent text,
  is_vip boolean not null default false,
  notes text,
  tags text[] not null default '{}'::text[],
  deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at bigint not null,
  deleted_by text,
  constraint g_donors_pkey PRIMARY KEY (client_id)
);

create table if not exists public.g_pledges (
  client_id text not null,
  donor_client_id text not null,
  amount numeric(14,2) not null default 0,
  cause text,
  agent text,
  note text,
  due_date date,
  deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at bigint not null,
  deleted_by text,
  constraint g_pledges_pkey PRIMARY KEY (client_id),
  constraint g_pledges_donor_client_id_fkey FOREIGN KEY (donor_client_id) REFERENCES g_donors(client_id) ON DELETE RESTRICT
);

create table if not exists public.g_settings (
  key text not null,
  value text not null default '[]'::text,
  updated_at bigint not null,
  client_id text,
  deleted boolean not null default false,
  deleted_at timestamp with time zone,
  deleted_by text,
  constraint g_settings_pkey PRIMARY KEY (key),
  constraint g_settings_value_json CHECK (((value IS NULL) OR ((value)::jsonb IS NOT NULL)))
);

create table if not exists public.g_targets (
  client_id text not null,
  month text not null,
  amount numeric(14,2) not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at bigint not null,
  deleted boolean not null default false,
  deleted_at timestamp with time zone,
  deleted_by text,
  constraint g_targets_pkey PRIMARY KEY (client_id),
  constraint g_targets_month_key UNIQUE (month),
  constraint g_targets_month_check CHECK ((month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text))
);

create table if not exists public.g_tasks (
  client_id text not null,
  title text not null,
  stage text not null default 'הכנה'::text,
  assignee text,
  domain text,
  due_date date,
  log text not null default ''::text,
  deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at bigint not null,
  deleted_by text,
  constraint g_tasks_pkey PRIMARY KEY (client_id),
  constraint g_tasks_stage_check CHECK ((stage = ANY (ARRAY['הכנה'::text, 'הרצה'::text, 'השלמה'::text, 'חסומה'::text])))
);

create table if not exists public.g_txns (
  client_id text not null,
  donor_client_id text not null,
  pledge_client_id text,
  amount numeric(14,2) not null default 0,
  txn_date date not null default CURRENT_DATE,
  category text,
  agent text,
  manager text,
  cleared boolean not null default true,
  note text,
  deleted boolean not null default false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at bigint not null,
  deleted_by text,
  constraint g_txns_pkey PRIMARY KEY (client_id),
  constraint g_txns_donor_client_id_fkey FOREIGN KEY (donor_client_id) REFERENCES g_donors(client_id) ON DELETE RESTRICT,
  constraint g_txns_pledge_client_id_fkey FOREIGN KEY (pledge_client_id) REFERENCES g_pledges(client_id) ON DELETE RESTRICT
);

create table if not exists public.g_users (
  client_id text not null,
  username text not null,
  full_name text not null,
  role text not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at bigint not null,
  pass_salt text,
  pass_fp text,
  constraint g_users_pkey PRIMARY KEY (client_id),
  constraint g_users_username_key UNIQUE (username),
  constraint g_users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'junior'::text])))
);

create index if not exists g_donors_live_idx ON public.g_donors USING btree (deleted, name);
create index if not exists g_pledges_donor_full_idx ON public.g_pledges USING btree (donor_client_id);
create index if not exists g_pledges_live_idx ON public.g_pledges USING btree (deleted, due_date);
create index if not exists g_tasks_stage_idx ON public.g_tasks USING btree (deleted, stage);
create index if not exists g_txns_date_idx ON public.g_txns USING btree (deleted, txn_date);
create index if not exists g_txns_donor_full_idx ON public.g_txns USING btree (donor_client_id);
create index if not exists g_txns_pledge_full_idx ON public.g_txns USING btree (pledge_client_id);

-- ⛔ revoke לפני grant — GRANT מוסיף ואינו מחליף, וטבלה חדשה ב-Supabase נולדת
--    עם DELETE ו-TRUNCATE ל-anon: המחיקה היא deleted=true, ולא DELETE.
revoke all on table public.g_donors from anon, authenticated;
grant select, insert, update on table public.g_donors to anon, authenticated;
grant all on table public.g_donors to service_role;
revoke all on table public.g_pledges from anon, authenticated;
grant select, insert, update on table public.g_pledges to anon, authenticated;
grant all on table public.g_pledges to service_role;
revoke all on table public.g_settings from anon, authenticated;
grant select, insert, update on table public.g_settings to anon, authenticated;
grant all on table public.g_settings to service_role;
revoke all on table public.g_targets from anon, authenticated;
grant select, insert, update on table public.g_targets to anon, authenticated;
grant all on table public.g_targets to service_role;
revoke all on table public.g_tasks from anon, authenticated;
grant select, insert, update on table public.g_tasks to anon, authenticated;
grant all on table public.g_tasks to service_role;
revoke all on table public.g_txns from anon, authenticated;
grant select, insert, update on table public.g_txns to anon, authenticated;
grant all on table public.g_txns to service_role;
revoke all on table public.g_users from anon, authenticated;
grant select, insert, update on table public.g_users to anon, authenticated;
grant all on table public.g_users to service_role;

alter table public.g_donors enable row level security;
drop policy if exists g_donors_all on public.g_donors;
create policy g_donors_all on public.g_donors as permissive for all to anon, authenticated using (true) with check (true);
alter table public.g_pledges enable row level security;
drop policy if exists g_pledges_all on public.g_pledges;
create policy g_pledges_all on public.g_pledges as permissive for all to anon, authenticated using (true) with check (true);
alter table public.g_settings enable row level security;
drop policy if exists g_settings_all on public.g_settings;
create policy g_settings_all on public.g_settings as permissive for all to anon, authenticated using (true) with check (true);
alter table public.g_targets enable row level security;
drop policy if exists g_targets_all on public.g_targets;
create policy g_targets_all on public.g_targets as permissive for all to anon, authenticated using (true) with check (true);
alter table public.g_tasks enable row level security;
drop policy if exists g_tasks_all on public.g_tasks;
create policy g_tasks_all on public.g_tasks as permissive for all to anon, authenticated using (true) with check (true);
alter table public.g_txns enable row level security;
drop policy if exists g_txns_all on public.g_txns;
create policy g_txns_all on public.g_txns as permissive for all to anon, authenticated using (true) with check (true);
alter table public.g_users enable row level security;
drop policy if exists g_users_all on public.g_users;
create policy g_users_all on public.g_users as permissive for all to anon, authenticated using (true) with check (true);
