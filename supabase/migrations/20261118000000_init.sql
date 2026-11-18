-- =====================================================================
-- StadtHelfer – Datenbank-Schema für Supabase (Postgres)
--
-- Grundprinzipien
--  * `profiles` ist PRIVAT (voller Name, Geburtsdatum, Telefon, Wohnort-Koordinaten).
--    Öffentlich ist nur die View `public_profiles` (Vorname + Initial, Alter, Stadt …).
--  * Ausweis-Prüfung: Auftraggeber, Eltern und Schüler ab 16 laden ihren Ausweis hoch,
--    das Moderationsteam prüft. Unter 16 (noch kein Personalausweis) genügt ein
--    verifizierter Elternteil.
--  * Schüler unter 18 sind erst sichtbar, wenn ein verifizierter Elternteil zugestimmt hat.
--  * Gesuche (job_posts) zeigen öffentlich nur einen ungefähren Ort (~1 km Raster).
--    Die genaue Adresse sieht der Schüler erst nach Zusage.
--  * Arbeitszeiten nach Jugendarbeitsschutzgesetz werden geprüft.
--  * Kontaktdaten (Telefon / E-Mail / Messenger) in Freitexten werden blockiert.
--  * Nach 3 Meldungen von verschiedenen Personen wird ein Konto automatisch gesperrt.
--  * Wenn beide einen Auftrag als fertig bestätigen, verschwindet der Chat sofort und
--    wird nach 7 Tagen endgültig gelöscht (außer es liegt eine Meldung vor).
--
-- Fehlermeldungen sind Codes (ERR_…), die App übersetzt sie (Deutsch/Englisch).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------

create or replace function public.age_on(birth date, at_date date)
returns int language sql immutable as $$
  select extract(year from age(at_date, birth))::int
$$;

-- Entfernung in km (Haversine)
create or replace function public.distance_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.contains_contact_data(txt text)
returns boolean language sql immutable as $$
  select txt is not null and (
    txt ~* '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\.[a-z]{2,}'
    or regexp_replace(txt, '[\s\-/().]', '', 'g') ~ '(\+|00)?\d{9,}'
    or txt ~* '(whats\s*app|telegram|snap\s*chat|instagram|insta:|signal\s*:)'
  )
$$;

create or replace function public.valid_service(s text)
returns boolean language sql immutable as $$
  select s in ('rasen', 'unkraut', 'hecke', 'fenster', 'nachhilfe', 'tanzen', 'yoga', 'sport',
               'instrument', 'einkaufen', 'gassi', 'babysitting', 'tagesmutter', 'senioren')
$$;

create or replace function public.is_privileged()
returns boolean language sql stable as $$
  -- Interne RPC-Funktionen setzen app.privileged; ohne Nutzer-Login (Dashboard /
  -- service_role) ist ebenfalls alles erlaubt. Anonyme API-Zugriffe scheitern vorher an RLS.
  select coalesce(current_setting('app.privileged', true), '') = 'on' or auth.uid() is null
$$;

create or replace function public.set_privileged(on_off boolean)
returns void language plpgsql as $$
begin
  perform set_config('app.privileged', case when on_off then 'on' else 'off' end, true);
end $$;

-- ---------------------------------------------------------------------
-- Profile (privat)
-- ---------------------------------------------------------------------

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                text not null check (role in ('student', 'client', 'parent')),
  first_name          text not null check (char_length(first_name) between 1 and 50),
  last_name           text not null check (char_length(last_name) between 1 and 50),
  birth_date          date not null,
  phone               text,
  city                text not null check (char_length(city) between 1 and 80),
  postal_code         text not null check (postal_code ~ '^\d{5}$'),
  home_lat            float8 check (home_lat between -90 and 90),
  home_lng            float8 check (home_lng between -180 and 180),
  radius_km           int not null default 10 check (radius_km between 1 and 50),
  bio                 text check (char_length(bio) <= 1000),
  availability_note   text check (char_length(availability_note) <= 300),
  language            text not null default 'de' check (language in ('de', 'en')),
  -- Schüler
  full_time_school    boolean not null default true,
  is_listed           boolean not null default true,
  parent_id           uuid references public.profiles(id) on delete set null,
  parent_consent      text not null default 'pending'
                        check (parent_consent in ('not_required', 'pending', 'approved', 'rejected')),
  parent_link_code    text unique,
  -- Ausweis-Prüfung
  verification_status text not null default 'none'
                        check (verification_status in ('none', 'pending', 'verified', 'rejected')),
  -- Moderation
  is_admin            boolean not null default false,
  is_suspended        boolean not null default false,
  suspended_reason    text,
  accepted_terms_at   timestamptz not null,
  terms_version       text not null default '2026-11',
  created_at          timestamptz not null default now()
);

create index profiles_parent_idx on public.profiles (parent_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_parent_of(child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = child and parent_id = auth.uid())
$$;

create or replace function public.my_parent_id()
returns uuid language sql stable security definer set search_path = public as $$
  select parent_id from public.profiles where id = auth.uid()
$$;

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a int := public.age_on(new.birth_date, current_date);
begin
  if tg_op = 'INSERT' then
    if new.role = 'student' and a < 14 then raise exception 'ERR_MIN_AGE_14'; end if;
    if new.role in ('client', 'parent') and a < 18 then raise exception 'ERR_MIN_AGE_18'; end if;
    if a > 120 then raise exception 'ERR_INVALID_BIRTHDATE'; end if;
    if not public.is_privileged() then
      new.is_admin := false;
      new.is_suspended := false;
      new.verification_status := 'none';
    end if;
    new.parent_id := null;
    if new.role = 'student' then
      new.parent_consent := case when a >= 18 then 'not_required' else 'pending' end;
      new.parent_link_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    else
      new.parent_consent := 'not_required';
      new.parent_link_code := null;
    end if;
  elsif not public.is_privileged() then
    -- Geschützte Felder ändern nur RPC-Funktionen / Admins.
    new.role := old.role;
    new.birth_date := old.birth_date;
    new.is_admin := old.is_admin;
    new.is_suspended := old.is_suspended;
    new.suspended_reason := old.suspended_reason;
    new.verification_status := old.verification_status;
    new.parent_id := old.parent_id;
    new.parent_consent := old.parent_consent;
    new.parent_link_code := old.parent_link_code;
    new.accepted_terms_at := old.accepted_terms_at;
    -- Namen nach der Ausweis-Prüfung nicht mehr änderbar
    if old.verification_status = 'verified' then
      new.first_name := old.first_name;
      new.last_name := old.last_name;
    end if;
  end if;

  if public.contains_contact_data(new.bio) or public.contains_contact_data(new.availability_note) then
    raise exception 'ERR_CONTACT_DATA';
  end if;
  return new;
end $$;

create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;
create policy "profil lesen" on public.profiles for select
  using (id = auth.uid() or public.is_parent_of(id) or public.is_admin() or id = public.my_parent_id());
create policy "profil anlegen" on public.profiles for insert with check (id = auth.uid());
create policy "profil ändern" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- Blockieren, Favoriten
-- ---------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "blocks eigene" on public.blocks for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create table public.favorites (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  favorite_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, favorite_id),
  check (user_id <> favorite_id)
);
alter table public.favorites enable row level security;
create policy "favoriten eigene" on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Sichtbarkeit / Verifizierung
-- ---------------------------------------------------------------------

-- Darf dieser Nutzer am Marktplatz teilnehmen (Ausweis- und Eltern-Regeln)?
create or replace function public.can_participate(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select not p.is_suspended and case
      when p.role = 'client' then p.verification_status = 'verified'
      when p.role = 'student' then
        (public.age_on(p.birth_date, current_date) < 16 or p.verification_status = 'verified')
        and (p.parent_consent = 'not_required'
             or (p.parent_consent = 'approved'
                 and exists (select 1 from public.profiles par
                             where par.id = p.parent_id and par.verification_status = 'verified')))
      else false end
    from public.profiles p where p.id = uid), false)
$$;

create or replace function public.student_is_visible(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = sid and role = 'student' and is_listed)
     and public.can_participate(sid)
     and not public.is_blocked_between(sid, auth.uid())
$$;

-- ---------------------------------------------------------------------
-- Angebote der Schüler (was sie machen und was sie dafür nehmen würden)
-- ---------------------------------------------------------------------

create table public.offers (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  service     text not null check (public.valid_service(service)),
  title       text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 1000),
  price_min   numeric(6,2) not null check (price_min >= 0),
  price_max   numeric(6,2) not null,
  price_unit  text not null default 'stunde' check (price_unit in ('stunde', 'auftrag')),
  created_at  timestamptz not null default now(),
  check (price_max >= price_min and price_max <= 200)
);
create index offers_student_idx on public.offers (student_id);

create or replace function public.offers_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.student_id;
  if p.role <> 'student' then raise exception 'ERR_ONLY_STUDENTS'; end if;
  if new.service = 'tagesmutter' and public.age_on(p.birth_date, current_date) < 18 then
    raise exception 'ERR_TAGESMUTTER_18';
  end if;
  if public.contains_contact_data(new.title) or public.contains_contact_data(new.description) then
    raise exception 'ERR_CONTACT_DATA';
  end if;
  return new;
end $$;
create trigger offers_guard before insert or update on public.offers
  for each row execute function public.offers_guard();

alter table public.offers enable row level security;
create policy "angebote lesen" on public.offers for select
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_admin()
         or (auth.uid() is not null and public.student_is_visible(student_id)));
create policy "angebote verwalten" on public.offers for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------------------------------------------------------------------
-- Gesuche der Auftraggeber (was gesucht wird und was man zahlen würde)
-- ---------------------------------------------------------------------

create table public.job_posts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  service          text not null check (public.valid_service(service)),
  title            text not null check (char_length(title) between 3 and 80),
  description      text not null check (char_length(description) between 5 and 2000),
  price_min        numeric(7,2) not null check (price_min >= 0),
  price_max        numeric(7,2) not null,
  price_unit       text not null default 'stunde' check (price_unit in ('stunde', 'auftrag')),
  scheduled_start  timestamptz not null,
  duration_minutes int not null check (duration_minutes between 15 and 480),
  -- Öffentlich nur gerundet (~1 km), genaue Lage steht in post_addresses
  approx_lat       float8 not null,
  approx_lng       float8 not null,
  city             text not null,
  postal_code      text not null check (postal_code ~ '^\d{5}$'),
  status           text not null default 'open' check (status in ('open', 'closed')),
  created_at       timestamptz not null default now(),
  check (price_max >= price_min and price_max <= 2000)
);
create index job_posts_open_idx on public.job_posts (status, service);
create index job_posts_client_idx on public.job_posts (client_id);

create table public.post_addresses (
  post_id     uuid primary key references public.job_posts(id) on delete cascade,
  street      text not null check (char_length(street) between 3 and 120),
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  city        text not null,
  notes       text check (char_length(notes) <= 500),
  lat         float8 not null,
  lng         float8 not null
);

create or replace function public.job_posts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not public.can_participate(new.client_id)
       or (select role from public.profiles where id = new.client_id) <> 'client' then
      raise exception 'ERR_VERIFY_FIRST';
    end if;
    if new.scheduled_start < now() then raise exception 'ERR_PAST_DATE'; end if;
    new.status := 'open';
  elsif old.status = 'closed' and new.status = 'open' and not public.is_privileged()
        and exists (select 1 from public.jobs where post_id = old.id and status in ('accepted', 'completed')) then
    new.status := 'closed';
  end if;
  -- Ort öffentlich nur gerundet speichern
  new.approx_lat := round(new.approx_lat::numeric, 2)::float8;
  new.approx_lng := round(new.approx_lng::numeric, 2)::float8;
  if public.contains_contact_data(new.title) or public.contains_contact_data(new.description) then
    raise exception 'ERR_CONTACT_DATA';
  end if;
  return new;
end $$;
create trigger job_posts_guard before insert or update on public.job_posts
  for each row execute function public.job_posts_guard();

create or replace function public.post_is_visible(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_posts jp
    where jp.id = pid and jp.status = 'open' and jp.scheduled_start > now()
      and public.can_participate(jp.client_id)
      and not public.is_blocked_between(jp.client_id, auth.uid()))
$$;

-- ---------------------------------------------------------------------
-- Aufträge (entstehen aus einem Gesuch: Bewerbung des Schülers oder Einladung)
-- ---------------------------------------------------------------------

create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references public.job_posts(id) on delete cascade,
  client_id        uuid not null references public.profiles(id) on delete cascade,
  student_id       uuid not null references public.profiles(id) on delete cascade,
  service          text not null,
  title            text not null,
  description      text not null,
  scheduled_start  timestamptz not null,
  duration_minutes int not null,
  agreed_price     numeric(7,2) not null check (agreed_price >= 0),
  initiated_by     text not null check (initiated_by in ('client', 'student')),
  status           text not null default 'requested'
                     check (status in ('requested', 'accepted', 'declined', 'cancelled', 'completed')),
  client_done      boolean not null default false,
  student_done     boolean not null default false,
  cancelled_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz,
  chat_deleted_at  timestamptz,
  unique (post_id, student_id)
);
create index jobs_client_idx on public.jobs (client_id);
create index jobs_student_idx on public.jobs (student_id);

-- Nachträglich, weil job_posts-Policy auf jobs verweist
alter table public.jobs enable row level security;
create policy "aufträge lesen" on public.jobs for select
  using (auth.uid() in (client_id, student_id) or public.is_parent_of(student_id) or public.is_admin());
-- Kein direktes Anlegen/Ändern: nur über die RPC-Funktionen unten.

alter table public.job_posts enable row level security;
create policy "gesuche lesen" on public.job_posts for select using (
  client_id = auth.uid() or public.is_admin()
  or (auth.uid() is not null and public.post_is_visible(id))
  or exists (select 1 from public.jobs j where j.post_id = id
             and (j.student_id = auth.uid() or public.is_parent_of(j.student_id)))
);
create policy "gesuche anlegen" on public.job_posts for insert with check (client_id = auth.uid());
create policy "gesuche ändern" on public.job_posts for update using (client_id = auth.uid());
create policy "gesuche löschen" on public.job_posts for delete using (client_id = auth.uid());


create policy "adresse lesen" on public.post_addresses for select using (
  exists (select 1 from public.job_posts jp where jp.id = post_id and jp.client_id = auth.uid())
  or public.is_admin()
  or exists (select 1 from public.jobs j where j.post_id = post_addresses.post_id
             and j.status in ('accepted', 'completed')
             and (j.student_id = auth.uid() or public.is_parent_of(j.student_id)))
);
create policy "adresse anlegen" on public.post_addresses for insert with check (
  exists (select 1 from public.job_posts jp where jp.id = post_id and jp.client_id = auth.uid()));
create policy "adresse ändern" on public.post_addresses for update using (
  exists (select 1 from public.job_posts jp where jp.id = post_id and jp.client_id = auth.uid()));
alter table public.post_addresses enable row level security;

-- Jugendschutz (JArbSchG, vereinfacht und bewusst streng)
--  * unter 15 oder vollzeitschulpflichtig: 8–18 Uhr, max. 2 Std. pro Tag
--  * 15–17, nicht mehr vollzeitschulpflichtig: 6–20 Uhr, max. 8 Std. pro Tag
create or replace function public.work_time_error(
  sid uuid, start_at timestamptz, minutes int, ignore_job uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  ls timestamp := start_at at time zone 'Europe/Berlin';
  le timestamp := (start_at + make_interval(mins => minutes)) at time zone 'Europe/Berlin';
  a int; min_h int; max_h int; max_m int; booked int;
begin
  select * into p from public.profiles where id = sid;
  a := public.age_on(p.birth_date, ls::date);
  if a >= 18 then return null; end if;
  if a < 15 or p.full_time_school then min_h := 8; max_h := 18; max_m := 120;
  else min_h := 6; max_h := 20; max_m := 480; end if;
  if ls::date <> le::date or extract(hour from ls) < min_h
     or le > date_trunc('day', le) + make_interval(hours => max_h) then
    return format('ERR_WORK_HOURS:%s:%s', min_h, max_h);
  end if;
  select coalesce(sum(duration_minutes), 0) into booked from public.jobs
   where student_id = sid and status = 'accepted' and id is distinct from ignore_job
     and (scheduled_start at time zone 'Europe/Berlin')::date = ls::date;
  if booked + minutes > max_m then
    return format('ERR_WORK_MINUTES:%s:%s', max_m, booked);
  end if;
  return null;
end $$;

create or replace function public.assert_work_time(sid uuid, start_at timestamptz, minutes int, ignore_job uuid default null)
returns void language plpgsql stable as $$
declare e text := public.work_time_error(sid, start_at, minutes, ignore_job);
begin
  if e is not null then raise exception '%', e; end if;
end $$;

-- Schüler bewirbt sich auf ein Gesuch (z. B. per Wisch nach rechts)
create or replace function public.apply_to_post(post uuid, price numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); jp public.job_posts; new_id uuid;
begin
  if (select role from public.profiles where id = me) <> 'student' or not public.can_participate(me) then
    raise exception 'ERR_NOT_ALLOWED';
  end if;
  select * into jp from public.job_posts where id = post;
  if jp.id is null or not public.post_is_visible(post) then raise exception 'ERR_NOT_AVAILABLE'; end if;
  if jp.service = 'tagesmutter' and public.age_on((select birth_date from public.profiles where id = me), current_date) < 18 then
    raise exception 'ERR_TAGESMUTTER_18';
  end if;
  perform public.assert_work_time(me, jp.scheduled_start, jp.duration_minutes);
  insert into public.jobs (post_id, client_id, student_id, service, title, description,
                           scheduled_start, duration_minutes, agreed_price, initiated_by)
  values (jp.id, jp.client_id, me, jp.service, jp.title, jp.description, jp.scheduled_start,
          jp.duration_minutes,
          coalesce(price, case when jp.price_unit = 'stunde'
                               then round(jp.price_max * jp.duration_minutes / 60.0, 2)
                               else jp.price_max end),
          'student')
  on conflict (post_id, student_id) do nothing
  returning id into new_id;
  if new_id is null then raise exception 'ERR_ALREADY_EXISTS'; end if;
  return new_id;
end $$;

-- Auftraggeber lädt einen Schüler zu seinem Gesuch ein
create or replace function public.invite_student(post uuid, student uuid, price numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); jp public.job_posts; new_id uuid;
begin
  select * into jp from public.job_posts where id = post and client_id = me;
  if jp.id is null or jp.status <> 'open' then raise exception 'ERR_NOT_AVAILABLE'; end if;
  if not public.can_participate(me) then raise exception 'ERR_VERIFY_FIRST'; end if;
  if not public.student_is_visible(student) then raise exception 'ERR_NOT_AVAILABLE'; end if;
  if jp.service = 'tagesmutter' and public.age_on((select birth_date from public.profiles where id = student), current_date) < 18 then
    raise exception 'ERR_TAGESMUTTER_18';
  end if;
  perform public.assert_work_time(student, jp.scheduled_start, jp.duration_minutes);
  insert into public.jobs (post_id, client_id, student_id, service, title, description,
                           scheduled_start, duration_minutes, agreed_price, initiated_by)
  values (jp.id, me, student, jp.service, jp.title, jp.description, jp.scheduled_start,
          jp.duration_minutes,
          coalesce(price, case when jp.price_unit = 'stunde'
                               then round(jp.price_max * jp.duration_minutes / 60.0, 2)
                               else jp.price_max end),
          'client')
  on conflict (post_id, student_id) do nothing
  returning id into new_id;
  if new_id is null then raise exception 'ERR_ALREADY_EXISTS'; end if;
  return new_id;
end $$;

-- Die jeweils andere Seite nimmt an oder lehnt ab
create or replace function public.respond_to_job(job uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); j public.jobs;
begin
  select * into j from public.jobs where id = job for update;
  if j.id is null or j.status <> 'requested' then raise exception 'ERR_NOT_ALLOWED'; end if;
  if not ((j.initiated_by = 'student' and me = j.client_id) or (j.initiated_by = 'client' and me = j.student_id)) then
    raise exception 'ERR_NOT_ALLOWED';
  end if;
  if accept then
    if not public.can_participate(j.student_id) or not public.can_participate(j.client_id) then
      raise exception 'ERR_NOT_AVAILABLE';
    end if;
    perform public.assert_work_time(j.student_id, j.scheduled_start, j.duration_minutes, j.id);
    update public.jobs set status = 'accepted', updated_at = now() where id = job;
    -- Gesuch ist vergeben: schließen und andere Anfragen ablehnen
    update public.job_posts set status = 'closed' where id = j.post_id;
    update public.jobs set status = 'declined', updated_at = now()
     where post_id = j.post_id and id <> job and status = 'requested';
  else
    update public.jobs set status = 'declined', updated_at = now() where id = job;
  end if;
end $$;

-- Absagen (Auftraggeber, Schüler oder Eltern des Schülers)
create or replace function public.cancel_job(job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); j public.jobs;
begin
  select * into j from public.jobs where id = job for update;
  if j.id is null or j.status not in ('requested', 'accepted')
     or not (me in (j.client_id, j.student_id) or public.is_parent_of(j.student_id) or public.is_admin()) then
    raise exception 'ERR_NOT_ALLOWED';
  end if;
  update public.jobs set status = 'cancelled', cancelled_by = me, updated_at = now() where id = job;
  update public.payments set status = 'refunded', updated_at = now() where job_id = job and status = 'held';
  -- Gesuch wieder öffnen, wenn der Termin noch in der Zukunft liegt
  if j.status = 'accepted' and me <> j.client_id then
    update public.job_posts set status = 'open' where id = j.post_id and scheduled_start > now();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Bezahlung (Testmodus). In Produktion ersetzt ein Zahlungsdienstleister
-- (z. B. Stripe Connect / PayPal) die Funktion demo_pay; Geld wird treuhänderisch
-- gehalten und erst nach beidseitiger Bestätigung ausgezahlt.
-- ---------------------------------------------------------------------

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null unique references public.jobs(id) on delete cascade,
  amount      numeric(7,2) not null check (amount >= 0),
  method      text not null check (method in ('paypal', 'bank', 'vivid', 'visa')),
  status      text not null check (status in ('held', 'released', 'refunded')),
  provider    text not null default 'demo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "zahlungen lesen" on public.payments for select using (
  exists (select 1 from public.jobs j where j.id = job_id
          and (auth.uid() in (j.client_id, j.student_id) or public.is_parent_of(j.student_id) or public.is_admin())));

create or replace function public.demo_pay(job uuid, method text)
returns void language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = job;
  if j.client_id is distinct from auth.uid() or j.status <> 'accepted' then raise exception 'ERR_NOT_ALLOWED'; end if;
  insert into public.payments (job_id, amount, method, status)
  values (job, j.agreed_price, method, 'held')
  on conflict (job_id) do nothing;
end $$;

-- Beide bestätigen „Fertig“. Danach: Auszahlung, Chat verschwindet.
create or replace function public.confirm_job_done(job uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); j public.jobs;
begin
  select * into j from public.jobs where id = job for update;
  if j.id is null or j.status <> 'accepted' or me not in (j.client_id, j.student_id) then
    raise exception 'ERR_NOT_ALLOWED';
  end if;
  if me = j.client_id and not exists (select 1 from public.payments where job_id = job and status = 'held') then
    raise exception 'ERR_PAY_FIRST';
  end if;
  update public.jobs set
    client_done = client_done or me = j.client_id,
    student_done = student_done or me = j.student_id,
    updated_at = now()
  where id = job returning * into j;
  if j.client_done and j.student_done then
    update public.jobs set status = 'completed', completed_at = now() where id = job;
    update public.payments set status = 'released', updated_at = now() where job_id = job;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_job_idx on public.messages (job_id, created_at);

create or replace function public.messages_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = new.job_id;
  if j.status not in ('requested', 'accepted') then raise exception 'ERR_CHAT_CLOSED'; end if;
  if public.is_blocked_between(j.client_id, j.student_id) then raise exception 'ERR_NOT_ALLOWED'; end if;
  if public.contains_contact_data(new.body) then raise exception 'ERR_CONTACT_DATA'; end if;
  new.created_at := now();
  return new;
end $$;
create trigger messages_guard before insert on public.messages
  for each row execute function public.messages_guard();

alter table public.messages enable row level security;
-- Beteiligte und Eltern sehen den Chat nur, solange der Auftrag läuft.
-- Admins sehen ihn bis zur endgültigen Löschung (für Meldungen).
create policy "chat lesen" on public.messages for select using (
  public.is_admin() or exists (
    select 1 from public.jobs j where j.id = job_id and j.status in ('requested', 'accepted')
      and (auth.uid() in (j.client_id, j.student_id) or public.is_parent_of(j.student_id))));
create policy "chat schreiben" on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.client_id, j.student_id)));

-- ---------------------------------------------------------------------
-- Fotos (Gesuch-Fotos „das muss gemacht werden“ und Portfolio „das habe ich gemacht“)
-- Dateien liegen im Storage-Bucket `photos` unter <user-id>/<datei>.
-- ---------------------------------------------------------------------

create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in ('post', 'portfolio')),
  post_id      uuid references public.job_posts(id) on delete cascade,
  storage_path text not null unique,
  caption      text check (char_length(caption) <= 200),
  created_at   timestamptz not null default now(),
  check ((kind = 'post') = (post_id is not null)),
  check (storage_path like owner_id::text || '/%')
);
create index photos_owner_idx on public.photos (owner_id);
create index photos_post_idx on public.photos (post_id);

create or replace function public.photos_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'post' and not exists (select 1 from public.job_posts where id = new.post_id and client_id = new.owner_id) then
    raise exception 'ERR_NOT_ALLOWED';
  end if;
  if new.kind = 'portfolio' and (select role from public.profiles where id = new.owner_id) <> 'student' then
    raise exception 'ERR_NOT_ALLOWED';
  end if;
  if (select count(*) from public.photos where owner_id = new.owner_id and kind = new.kind
      and post_id is not distinct from new.post_id) >= (case when new.kind = 'post' then 5 else 12 end) then
    raise exception 'ERR_TOO_MANY_PHOTOS';
  end if;
  if public.contains_contact_data(new.caption) then raise exception 'ERR_CONTACT_DATA'; end if;
  return new;
end $$;
create trigger photos_guard before insert on public.photos
  for each row execute function public.photos_guard();

alter table public.photos enable row level security;
create policy "fotos lesen" on public.photos for select using (
  owner_id = auth.uid() or public.is_admin() or public.is_parent_of(owner_id)
  or (kind = 'portfolio' and auth.uid() is not null and public.student_is_visible(owner_id))
  or (kind = 'post' and exists (select 1 from public.job_posts jp where jp.id = post_id)));
create policy "fotos anlegen" on public.photos for insert with check (owner_id = auth.uid());
create policy "fotos löschen" on public.photos for delete using (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- Ausweis-Prüfung. Bilder liegen im privaten Bucket `id-documents`,
-- nur der Nutzer selbst (hochladen) und Admins (ansehen) haben Zugriff.
-- Nach der Prüfung löscht die App die Bilder (Datensparsamkeit).
-- ---------------------------------------------------------------------

create table public.verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  doc_type     text not null check (doc_type in ('personalausweis', 'reisepass', 'aufenthaltstitel')),
  front_path   text,
  back_path    text,
  selfie_path  text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note   text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
alter table public.verifications enable row level security;
create policy "verifizierung lesen" on public.verifications for select using (user_id = auth.uid() or public.is_admin());
create policy "verifizierung anlegen" on public.verifications for insert
  with check (user_id = auth.uid() and status = 'pending' and admin_note is null);

create or replace function public.verifications_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.set_privileged(true);
  update public.profiles set verification_status = 'pending' where id = new.user_id and verification_status <> 'verified';
  perform public.set_privileged(false);
  return new;
end $$;
create trigger verifications_after_insert after insert on public.verifications
  for each row execute function public.verifications_after_insert();

create or replace function public.admin_review_verification(verification uuid, approve boolean, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.verifications;
begin
  if not public.is_admin() then raise exception 'ERR_NOT_ALLOWED'; end if;
  update public.verifications
     set status = case when approve then 'approved' else 'rejected' end, admin_note = note, reviewed_at = now(),
         front_path = null, back_path = null, selfie_path = null   -- Dateien löscht die App im Storage
   where id = verification returning * into v;
  perform public.set_privileged(true);
  update public.profiles set verification_status = case when approve then 'verified' else 'rejected' end
   where id = v.user_id;
  perform public.set_privileged(false);
end $$;

-- ---------------------------------------------------------------------
-- Bewertungen
-- ---------------------------------------------------------------------

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now(),
  unique (job_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id);

create or replace function public.reviews_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = new.job_id;
  if j.status <> 'completed' then raise exception 'ERR_REVIEW_AFTER_DONE'; end if;
  if new.reviewer_id = j.client_id then new.reviewee_id := j.student_id;
  elsif new.reviewer_id = j.student_id then new.reviewee_id := j.client_id;
  else raise exception 'ERR_NOT_ALLOWED'; end if;
  if public.contains_contact_data(new.comment) then raise exception 'ERR_CONTACT_DATA'; end if;
  return new;
end $$;
create trigger reviews_guard before insert on public.reviews
  for each row execute function public.reviews_guard();

alter table public.reviews enable row level security;
create policy "bewertungen lesen" on public.reviews for select using (auth.uid() is not null);
create policy "bewertungen schreiben" on public.reviews for insert with check (reviewer_id = auth.uid());

-- ---------------------------------------------------------------------
-- Meldungen. Ab 3 Meldungen von verschiedenen Personen: automatische Sperre.
-- ---------------------------------------------------------------------

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  job_id           uuid references public.jobs(id) on delete set null,
  reason           text not null check (reason in (
                     'belaestigung', 'unangemessen', 'betrug', 'gefahr', 'fake_profil', 'sonstiges')),
  details          text check (char_length(details) <= 2000),
  status           text not null default 'open' check (status in ('open', 'resolved')),
  admin_note       text,
  created_at       timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create unique index reports_one_open_per_pair on public.reports (reporter_id, reported_user_id) where status = 'open';

alter table public.reports enable row level security;
create policy "meldungen lesen" on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy "meldungen erstellen" on public.reports for insert
  with check (reporter_id = auth.uid() and status = 'open' and admin_note is null);
create policy "meldungen bearbeiten" on public.reports for update using (public.is_admin());

create or replace function public.reports_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(distinct reporter_id) from public.reports
      where reported_user_id = new.reported_user_id and status = 'open') >= 3 then
    perform public.suspend_user(new.reported_user_id, 'auto_3_reports');
  end if;
  return new;
end $$;

create or replace function public.suspend_user(target uuid, reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.set_privileged(true);
  update public.profiles set is_suspended = true, suspended_reason = reason, is_listed = false where id = target;
  update public.jobs set status = 'cancelled', updated_at = now()
   where (client_id = target or student_id = target) and status in ('requested', 'accepted');
  update public.payments set status = 'refunded', updated_at = now()
   where status = 'held' and job_id in (select id from public.jobs where client_id = target or student_id = target);
  update public.job_posts set status = 'closed' where client_id = target;
  perform public.set_privileged(false);
end $$;

create trigger reports_after_insert after insert on public.reports
  for each row execute function public.reports_after_insert();

create or replace function public.admin_set_suspended(target uuid, suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ERR_NOT_ALLOWED'; end if;
  if suspended then
    perform public.suspend_user(target, 'admin');
  else
    perform public.set_privileged(true);
    update public.profiles set is_suspended = false, suspended_reason = null where id = target;
    update public.reports set status = 'resolved' where reported_user_id = target and status = 'open';
    perform public.set_privileged(false);
  end if;
end $$;

create or replace function public.admin_suspended_users()
returns table (id uuid, first_name text, last_name text, role text, suspended_reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ERR_NOT_ALLOWED'; end if;
  return query select p.id, p.first_name, p.last_name, p.role, p.suspended_reason
               from public.profiles p where p.is_suspended order by p.first_name;
end $$;

-- ---------------------------------------------------------------------
-- Chats nach Abschluss endgültig löschen (7 Tage Sicherheitsfrist, außer bei Meldung)
-- ---------------------------------------------------------------------

create or replace function public.purge_finished_chats()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with done as (
    select j.id from public.jobs j
    where j.status in ('completed', 'cancelled', 'declined') and j.chat_deleted_at is null
      and j.updated_at < now() - interval '7 days'
      and not exists (select 1 from public.reports r where r.status = 'open'
                      and (r.job_id = j.id or r.reported_user_id in (j.client_id, j.student_id)))
  ), del as (
    delete from public.messages m using done where m.job_id = done.id returning m.id
  )
  select count(*) into n from del;
  update public.jobs set chat_deleted_at = now()
   where status in ('completed', 'cancelled', 'declined') and chat_deleted_at is null
     and updated_at < now() - interval '7 days'
     and not exists (select 1 from public.messages m where m.job_id = jobs.id);
  return n;
end $$;

-- Täglich ausführen, falls pg_cron aktiviert ist (Supabase: Database → Extensions → pg_cron)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-finished-chats', '17 3 * * *', 'select public.purge_finished_chats()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Öffentliche Profil-Ansicht (nur unkritische Felder)
-- ---------------------------------------------------------------------

create or replace view public.public_profiles with (security_invoker = false) as
select
  p.id,
  p.role,
  p.first_name || ' ' || left(p.last_name, 1) || '.' as display_name,
  public.age_on(p.birth_date, current_date) as age,
  p.city,
  p.radius_km,
  p.bio,
  p.availability_note,
  p.verification_status = 'verified' as is_verified,
  public.can_participate(p.id) as can_participate,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.reviewee_id = p.id)::float8 as avg_rating,
  (select count(*) from public.reviews r where r.reviewee_id = p.id)::int as review_count,
  (select count(*) from public.jobs j where (j.student_id = p.id or j.client_id = p.id) and j.status = 'completed')::int as completed_jobs,
  case when p.role <> 'student' or public.age_on(p.birth_date, current_date) >= 18 then null
       when public.age_on(p.birth_date, current_date) < 15 or p.full_time_school then 8 else 6 end as work_min_hour,
  case when p.role <> 'student' or public.age_on(p.birth_date, current_date) >= 18 then null
       when public.age_on(p.birth_date, current_date) < 15 or p.full_time_school then 18 else 20 end as work_max_hour,
  case when p.role <> 'student' or public.age_on(p.birth_date, current_date) >= 18 then null
       when public.age_on(p.birth_date, current_date) < 15 or p.full_time_school then 120 else 480 end as work_max_minutes,
  p.created_at
from public.profiles p
where auth.uid() is not null
  and not p.is_suspended
  and (p.id = auth.uid() or not public.is_blocked_between(p.id, auth.uid()))
  and (
    p.id = auth.uid() or public.is_admin() or public.is_parent_of(p.id)
    or (p.role = 'student' and public.student_is_visible(p.id))
    or (p.role = 'client' and public.can_participate(p.id))
    or exists (select 1 from public.jobs j
               where (j.client_id = p.id and (j.student_id = auth.uid() or public.is_parent_of(j.student_id)))
                  or (j.student_id = p.id and j.client_id = auth.uid()))
  );
revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- ---------------------------------------------------------------------
-- Vorschläge (für die Wisch-Ansicht) und Karte
-- ---------------------------------------------------------------------

create table public.swipes (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'student')),
  target_id   uuid not null,
  context_id  uuid,                 -- bei Auftraggebern: für welches Gesuch
  liked       boolean not null,
  created_at  timestamptz not null default now()
);
create unique index swipes_unique on public.swipes
  (user_id, target_kind, target_id, coalesce(context_id, '00000000-0000-0000-0000-000000000000'));
alter table public.swipes enable row level security;
create policy "swipes eigene" on public.swipes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Für Schüler: passende offene Gesuche im eigenen Umkreis
create or replace function public.student_suggestions()
returns table (
  post_id uuid, client_id uuid, client_name text, client_rating float8, client_reviews int,
  service text, title text, description text, price_min numeric, price_max numeric, price_unit text,
  scheduled_start timestamptz, duration_minutes int, city text, approx_lat float8, approx_lng float8,
  distance_km float8, photo_count int, is_favorite boolean)
language sql stable security definer set search_path = public as $$
  with me as (select * from public.profiles where id = auth.uid() and role = 'student')
  select jp.id, jp.client_id,
         c.first_name || ' ' || left(c.last_name, 1) || '.',
         (select avg(r.rating)::float8 from public.reviews r where r.reviewee_id = jp.client_id),
         (select count(*)::int from public.reviews r where r.reviewee_id = jp.client_id),
         jp.service, jp.title, jp.description, jp.price_min, jp.price_max, jp.price_unit,
         jp.scheduled_start, jp.duration_minutes, jp.city, jp.approx_lat, jp.approx_lng,
         greatest(1, round(public.distance_km(me.home_lat, me.home_lng, jp.approx_lat, jp.approx_lng)))::float8,
         (select count(*)::int from public.photos ph where ph.post_id = jp.id),
         exists (select 1 from public.favorites f where f.user_id = me.id and f.favorite_id = jp.client_id)
  from me
  join public.job_posts jp on jp.status = 'open' and jp.scheduled_start > now()
  join public.profiles c on c.id = jp.client_id
  where public.can_participate(me.id)
    and me.home_lat is not null
    and public.post_is_visible(jp.id)
    and public.distance_km(me.home_lat, me.home_lng, jp.approx_lat, jp.approx_lng) <= me.radius_km
    and jp.service in (select o.service from public.offers o where o.student_id = me.id)
    and (jp.service <> 'tagesmutter' or public.age_on(me.birth_date, current_date) >= 18)
    and public.work_time_error(me.id, jp.scheduled_start, jp.duration_minutes) is null
    and not exists (select 1 from public.swipes s where s.user_id = me.id and s.target_kind = 'post' and s.target_id = jp.id)
    and not exists (select 1 from public.jobs j where j.post_id = jp.id and j.student_id = me.id)
  order by exists (select 1 from public.favorites f where f.user_id = me.id and f.favorite_id = jp.client_id) desc,
           public.distance_km(me.home_lat, me.home_lng, jp.approx_lat, jp.approx_lng), jp.scheduled_start
  limit 50
$$;

-- Für Auftraggeber: passende Schüler zu den eigenen offenen Gesuchen.
-- Ein Schüler passt, wenn das Gesuch in SEINEM Umkreis liegt.
create or replace function public.client_suggestions()
returns table (
  student_id uuid, display_name text, age int, avg_rating float8, review_count int, completed_jobs int,
  bio text, offer_id uuid, offer_title text, service text, price_min numeric, price_max numeric, price_unit text,
  post_id uuid, post_title text, distance_km float8, portfolio_count int, is_favorite boolean)
language sql stable security definer set search_path = public as $$
  select distinct on (s.id, jp.id)
         s.id, s.first_name || ' ' || left(s.last_name, 1) || '.', public.age_on(s.birth_date, current_date),
         (select avg(r.rating)::float8 from public.reviews r where r.reviewee_id = s.id),
         (select count(*)::int from public.reviews r where r.reviewee_id = s.id),
         (select count(*)::int from public.jobs j2 where j2.student_id = s.id and j2.status = 'completed'),
         s.bio, o.id, o.title, o.service, o.price_min, o.price_max, o.price_unit,
         jp.id, jp.title,
         greatest(1, round(public.distance_km(a.lat, a.lng, s.home_lat, s.home_lng)))::float8,
         (select count(*)::int from public.photos ph where ph.owner_id = s.id and ph.kind = 'portfolio'),
         exists (select 1 from public.favorites f where f.user_id = auth.uid() and f.favorite_id = s.id)
  from public.job_posts jp
  join public.post_addresses a on a.post_id = jp.id
  join public.offers o on o.service = jp.service
  join public.profiles s on s.id = o.student_id
  where jp.client_id = auth.uid() and jp.status = 'open' and jp.scheduled_start > now()
    and public.can_participate(auth.uid())
    and s.home_lat is not null
    and public.student_is_visible(s.id)
    and public.distance_km(a.lat, a.lng, s.home_lat, s.home_lng) <= s.radius_km
    and (jp.service <> 'tagesmutter' or public.age_on(s.birth_date, current_date) >= 18)
    and public.work_time_error(s.id, jp.scheduled_start, jp.duration_minutes) is null
    and not exists (select 1 from public.swipes sw where sw.user_id = auth.uid() and sw.target_kind = 'student'
                    and sw.target_id = s.id and sw.context_id = jp.id)
    and not exists (select 1 from public.jobs j where j.post_id = jp.id and j.student_id = s.id)
  order by s.id, jp.id
$$;

-- Für die Karte (Schüler): offene Gesuche im Umkreis, nur ungefährer Ort
create or replace function public.map_posts()
returns table (post_id uuid, service text, title text, approx_lat float8, approx_lng float8,
               price_min numeric, price_max numeric, price_unit text, scheduled_start timestamptz, distance_km float8)
language sql stable security definer set search_path = public as $$
  with me as (select * from public.profiles where id = auth.uid())
  select jp.id, jp.service, jp.title, jp.approx_lat, jp.approx_lng, jp.price_min, jp.price_max, jp.price_unit,
         jp.scheduled_start,
         greatest(1, round(public.distance_km(me.home_lat, me.home_lng, jp.approx_lat, jp.approx_lng)))::float8
  from me join public.job_posts jp on true
  where me.home_lat is not null and public.can_participate(me.id)
    and public.post_is_visible(jp.id) and jp.client_id <> me.id
    and public.distance_km(me.home_lat, me.home_lng, jp.approx_lat, jp.approx_lng) <= me.radius_km
$$;

-- Für Eltern: Wo, wann und bei wem ist mein Kind? (inkl. voller Name und Telefon
-- des verifizierten Auftraggebers sowie genauer Adresse nach Zusage)
create or replace function public.child_jobs(child uuid)
returns table (job_id uuid, status text, service text, title text, scheduled_start timestamptz,
               duration_minutes int, agreed_price numeric, client_name text, client_phone text,
               client_verified boolean, street text, postal_code text, city text, lat float8, lng float8)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_parent_of(child) then raise exception 'ERR_NOT_ALLOWED'; end if;
  return query
    select j.id, j.status, j.service, j.title, j.scheduled_start, j.duration_minutes, j.agreed_price,
           c.first_name || ' ' || c.last_name,
           case when j.status = 'accepted' then c.phone end,
           c.verification_status = 'verified',
           case when j.status in ('accepted', 'completed') then a.street end,
           a.postal_code, a.city,
           case when j.status = 'accepted' then a.lat end,
           case when j.status = 'accepted' then a.lng end
    from public.jobs j
    join public.profiles c on c.id = j.client_id
    left join public.post_addresses a on a.post_id = j.post_id
    where j.student_id = child
    order by (j.status in ('requested', 'accepted')) desc, j.scheduled_start;
end $$;

-- ---------------------------------------------------------------------
-- Eltern, Blockliste, Konto
-- ---------------------------------------------------------------------

create or replace function public.link_child(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare child public.profiles; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.role is distinct from 'parent' then raise exception 'ERR_ONLY_PARENTS'; end if;
  select * into child from public.profiles where parent_link_code = upper(trim(code)) and role = 'student';
  if child.id is null then raise exception 'ERR_CODE_NOT_FOUND'; end if;
  if child.parent_id is not null and child.parent_id <> me.id then raise exception 'ERR_ALREADY_LINKED'; end if;
  perform public.set_privileged(true);
  update public.profiles set parent_id = me.id where id = child.id;
  perform public.set_privileged(false);
  return child.id;
end $$;

create or replace function public.set_parent_consent(child uuid, approved boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent_of(child) then raise exception 'ERR_NOT_ALLOWED'; end if;
  if approved and (select verification_status from public.profiles where id = auth.uid()) <> 'verified' then
    raise exception 'ERR_PARENT_VERIFY_FIRST';
  end if;
  perform public.set_privileged(true);
  update public.profiles set parent_consent = case when approved then 'approved' else 'rejected' end
   where id = child and parent_consent <> 'not_required';
  if not approved then
    update public.jobs set status = 'cancelled', cancelled_by = auth.uid(), updated_at = now()
     where student_id = child and status in ('requested', 'accepted');
    update public.payments set status = 'refunded', updated_at = now()
     where status = 'held' and job_id in (select id from public.jobs where student_id = child);
  end if;
  perform public.set_privileged(false);
end $$;

create or replace function public.my_blocked_users()
returns table (id uuid, display_name text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name || ' ' || left(p.last_name, 1) || '.', b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc
$$;

create or replace function public.my_favorites()
returns table (id uuid, display_name text, role text, avg_rating float8)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name || ' ' || left(p.last_name, 1) || '.', p.role,
         (select avg(r.rating)::float8 from public.reviews r where r.reviewee_id = p.id)
  from public.favorites f join public.profiles p on p.id = f.favorite_id
  where f.user_id = auth.uid() and not p.is_suspended order by f.created_at desc
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'ERR_NOT_ALLOWED'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Admin-Hilfen
create or replace function public.admin_report_chat(report uuid)
returns table (job_id uuid, job_title text, sender_name text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare r public.reports;
begin
  if not public.is_admin() then raise exception 'ERR_NOT_ALLOWED'; end if;
  select * into r from public.reports where id = report;
  return query
    select j.id, j.title, s.first_name || ' ' || s.last_name, m.body, m.created_at
    from public.jobs j
    join public.messages m on m.job_id = j.id
    join public.profiles s on s.id = m.sender_id
    where (r.job_id is not null and j.id = r.job_id)
       or (r.job_id is null and r.reporter_id in (j.client_id, j.student_id)
           and r.reported_user_id in (j.client_id, j.student_id))
    order by j.id, m.created_at;
end $$;

-- Ausführungsrechte: nur angemeldete Nutzer (und service_role) dürfen Funktionen aufrufen
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f.sig);
    end if;
  end loop;
end $$;
-- Interne Funktionen: nicht direkt aufrufbar
revoke execute on function public.suspend_user(uuid, text) from authenticated;
revoke execute on function public.purge_finished_chats() from authenticated;
revoke execute on function public.set_privileged(boolean) from authenticated;

-- ---------------------------------------------------------------------
-- Storage-Buckets und Regeln (nur in Supabase vorhanden)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict do nothing;
    insert into storage.buckets (id, name, public) values ('id-documents', 'id-documents', false) on conflict do nothing;

    execute $p$create policy "fotos lesen" on storage.objects for select to authenticated
      using (bucket_id = 'photos')$p$;
    execute $p$create policy "fotos hochladen" on storage.objects for insert to authenticated
      with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "fotos löschen" on storage.objects for delete to authenticated
      using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))$p$;

    execute $p$create policy "ausweis hochladen" on storage.objects for insert to authenticated
      with check (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "ausweis lesen" on storage.objects for select to authenticated
      using (bucket_id = 'id-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))$p$;
    execute $p$create policy "ausweis löschen" on storage.objects for delete to authenticated
      using (bucket_id = 'id-documents' and public.is_admin())$p$;
  end if;
end $$;

-- Realtime für Chat und Auftragsstatus
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.jobs;
  end if;
end $$;
