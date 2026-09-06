-- ============================================================================
-- 015_client_id_is_the_key.sql — `client_id:text` הוא מפתח הזהות בכל טבלה
-- ============================================================================
--
-- ⛔ **רץ במסד.**
--
-- ⛔⛔ **מה הקובץ עושה:** ⚠️ מסב את `id` ל-`client_id` בחמש טבלאות הישויות
--    ⛔ ואת שלושת המפתחות הזרים איתו — `donor_id` ⟵ `donor_client_id` ·
--    `pledge_id` ⟵ `pledge_client_id`, ⭐ והטיפוס `uuid` הופך ל-`text`.
--
-- ⛔⛔ **הנימוק:** ⚠️ ארבע האפליקציות מחזיקות מזהה שנוצר במכשיר, ⭐ ובשלוש
--    הוא נקרא `client_id:text`: ⛔ שם שני וטיפוס שני לאותו מושג הם בדיוק
--    מה שמונע מכל שער להצליב ביניהן. ⚠️ **והערך נשמר** (`id::text`) —
--    ⭐ מכשיר שמחזיק מראה מלפני המיגרציה מפתח את שורותיו לפי אותו ערך,
--    ⛔ ומזהה חדש היה נראה לו רשומה שנייה.
--
-- ⚠️ **ואין `default`** — ⛔ ולא `gen_random_uuid()`: ⭐ המזהה נוצר במכשיר
--    **לפני** שראה שרת, ⛔ וברירת מחדל בצד השרת היא מקור מזהה שני שמתמלא
--    בשקט כשהקוד שוכח.
--
-- ⛔ **נמדד לפני ההסבה:** ⚠️ 1 · 0 · 1 · 0 · 1 שורות בחמש הטבלאות,
--    ⭐ ואפס שורות עם מפתח זר ריק.
-- ============================================================================

do $$
declare t text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'g_donors'
                    and column_name = 'id')
  then return; end if;

  alter table public.g_pledges drop constraint if exists g_pledges_donor_id_fkey;
  alter table public.g_txns    drop constraint if exists g_txns_donor_id_fkey;
  alter table public.g_txns    drop constraint if exists g_txns_pledge_id_fkey;
  drop index if exists public.g_donors_live_idx;
  drop index if exists public.g_pledges_live_idx;
  drop index if exists public.g_pledges_donor_full_idx;
  drop index if exists public.g_txns_donor_full_idx;
  drop index if exists public.g_txns_pledge_full_idx;

  foreach t in array array['g_donors','g_pledges','g_txns','g_tasks','g_targets'] loop
    execute format('alter table public.%I alter column id drop default', t);
    execute format('alter table public.%I alter column id type text using id::text', t);
    execute format('alter table public.%I rename column id to client_id', t);
  end loop;

  alter table public.g_pledges alter column donor_id  type text using donor_id::text;
  alter table public.g_txns    alter column donor_id  type text using donor_id::text;
  alter table public.g_txns    alter column pledge_id type text using pledge_id::text;
  alter table public.g_pledges rename column donor_id  to donor_client_id;
  alter table public.g_txns    rename column donor_id  to donor_client_id;
  alter table public.g_txns    rename column pledge_id to pledge_client_id;

  alter table public.g_pledges
    add constraint g_pledges_donor_client_id_fkey
    foreign key (donor_client_id) references public.g_donors(client_id) on delete restrict;
  alter table public.g_txns
    add constraint g_txns_donor_client_id_fkey
    foreign key (donor_client_id) references public.g_donors(client_id) on delete restrict;
  alter table public.g_txns
    add constraint g_txns_pledge_client_id_fkey
    foreign key (pledge_client_id) references public.g_pledges(client_id) on delete restrict;

  create index if not exists g_donors_live_idx        on public.g_donors (deleted, name);
  create index if not exists g_pledges_live_idx       on public.g_pledges (deleted, due_date);
  create index if not exists g_pledges_donor_full_idx on public.g_pledges (donor_client_id);
  create index if not exists g_txns_donor_full_idx    on public.g_txns (donor_client_id);
  create index if not exists g_txns_pledge_full_idx   on public.g_txns (pledge_client_id);
end $$;
