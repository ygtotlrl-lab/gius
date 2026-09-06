-- ============================================================================
-- 014_users_client_id_shape.sql — `g_users` בצורת טבלת המשתמשים המשותפת
-- ============================================================================
--
-- ⛔ **רץ במסד.**
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ בונה את הטבלה מחדש בתשע עמודות, **בסדר**:
--    `client_id` · `username` · `full_name` · `role` · `active` ·
--    `created_at` · `updated_at` · `pass_salt` · `pass_fp`.
--
-- ⛔⛔ **ולמה בנייה מחדש ולא `alter`:** ⚠️ פוסטגרס אינו יודע לשנות **סדר**
--    עמודות — ⭐ והסדר הוא חלק מהתקן: ⛔ שלוש טבלאות משתמשים שנבדלות
--    בסדר אינן ניתנות להשוואה בעין.
--
-- ⛔ **`id` ה-`uuid` יורד ו-`client_id` נכנס במקומו** — ⚠️ **והערך נשמר**
--    (`id::text`): ⭐ מזהה שנשמר הוא מזהה שאפשר לעקוב אחריו, ⛔ ומזהה חדש
--    היה מנתק כל מטמון כניסה אופליין קיים. ⚠️ **ואין `default`** —
--    ⛔ המזהה נוצר במכשיר: ⭐ ברירת מחדל בצד השרת היא מקור מזהה שני.
--
-- ⛔ **המדיניות וההרשאות נבנות מחדש במפורש** — ⚠️ `drop table` גורע איתה
--    את ה-policy ואת ה-`grant`.
--
-- ⛔ **נמדד לפני הבנייה:** ⚠️ שורה אחת · אפס מפתחות זרים שמצביעים עליה.
-- ============================================================================

do $$
begin
  if to_regclass('public.g_users') is null
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'g_users'
                   and column_name = 'client_id')
  then return; end if;

  create table if not exists public.g_users__new (
    client_id  text        not null,
    username   text        not null,
    full_name  text        not null,
    role       text        not null,
    active     boolean     not null default true,
    created_at timestamptz not null default now(),
    updated_at bigint      not null,
    pass_salt  text,
    pass_fp    text,
    primary key (client_id),
    unique (username)
  );

  insert into public.g_users__new
    (client_id, username, full_name, role, active, created_at, updated_at, pass_salt, pass_fp)
  select id::text, username, full_name, role, coalesce(active, true),
         coalesce(created_at, now()), updated_at, pass_salt, pass_fp
  from public.g_users;

  drop table public.g_users;
  alter table public.g_users__new rename to g_users;
  alter index public.g_users__new_pkey         rename to g_users_pkey;
  alter index public.g_users__new_username_key rename to g_users_username_key;

  alter table public.g_users enable row level security;
  create policy g_users_open on public.g_users for all using (true) with check (true);
  grant select, insert, update on public.g_users to anon, authenticated;
end $$;
