-- =====================================================================
-- Schülerhilfe – Datenbank-Schema für Supabase (Postgres)
--
-- Grundprinzipien:
--  * Die Tabelle `profiles` ist PRIVAT (voller Name, Geburtsdatum, Telefon).
--    Öffentlich sichtbar ist nur die View `public_profiles`
--    (Vorname + Initial, Alter, Stadt, Bewertungen).
--  * Schüler unter 18 sind erst sichtbar, wenn ein Elternteil zugestimmt hat.
--  * Auftraggeber müssen verifiziert sein, bevor sie Anfragen senden dürfen.
--  * Die genaue Adresse eines Auftrags sieht der Schüler erst nach Annahme.
--  * Arbeitszeiten werden nach dem Jugendarbeitsschutzgesetz geprüft.
--  * Kontaktdaten (Telefon / E-Mail) im Chat und im Profiltext werden blockiert.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------

create or replace function public.age_on(birth date, at_date date)
returns int language sql immutable as $$
  select extract(year from age(at_date, birth))::int
$$;

-- Erkennt Telefonnummern, E-Mail-Adressen und Messenger-Hinweise in Freitext.
create or replace function public.contains_contact_data(txt text)
returns boolean language sql immutable as $$
  select txt is not null and (
    txt ~* '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\.[a-z]{2,}'
    or regexp_replace(txt, '[\s\-/().]', '', 'g') ~ '(\+|00)?\d{9,}'
    or txt ~* '(whats\s*app|telegram|snap\s*chat|instagram|insta:|signal\s*:)'
  )
$$;

-- ---------------------------------------------------------------------
-- Profile (privat)
-- ---------------------------------------------------------------------

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               text not null check (role in ('student', 'client', 'parent')),
  first_name         text not null check (char_length(first_name) between 1 and 50),
  last_name          text not null check (char_length(last_name) between 1 and 50),
  birth_date         date not null,
  phone              text,
  city               text not null check (char_length(city) between 1 and 80),
  postal_code        text not null check (postal_code ~ '^\d{5}$'),
  bio                text check (char_length(bio) <= 1000),
  -- Schüler
  radius_km          int not null default 5 check (radius_km between 1 and 50),
  availability_note  text check (char_length(availability_note) <= 300),
  full_time_school   boolean not null default true,  -- vollzeitschulpflichtig
  is_listed          boolean not null default true,  -- Schüler kann sich unsichtbar schalten
  parent_id          uuid references public.profiles(id) on delete set null,
  parent_consent     text not null default 'pending'
                       check (parent_consent in ('not_required', 'pending', 'approved', 'rejected')),
  parent_link_code   text unique,
  -- Verifizierung (Auftraggeber + Eltern)
  verification_status text not null default 'none'
                       check (verification_status in ('none', 'requested', 'verified', 'rejected')),
  -- Moderation
  is_admin           boolean not null default false,
  is_suspended       boolean not null default false,
  accepted_terms_at  timestamptz not null,
  created_at         timestamptz not null default now()
);

create index profiles_postal_code_idx on public.profiles (postal_code);
create index profiles_city_idx on public.profiles (lower(city));
create index profiles_parent_idx on public.profiles (parent_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_parent_of(child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = child and parent_id = auth.uid() and parent_id is not null
  )
$$;

-- Prüft und normalisiert Profile bei Anlage / Änderung.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a int := public.age_on(new.birth_date, current_date);
  -- Privilegiert: interne RPC-Funktionen oder Zugriff ohne Nutzer-Login
  -- (Supabase-Dashboard / service_role). Anonyme API-Zugriffe kommen wegen RLS
  -- gar nicht bis hierher.
  privileged boolean := coalesce(current_setting('app.privileged', true), '') = 'on'
                        or auth.uid() is null;
begin
  if tg_op = 'INSERT' then
    if new.role = 'student' and a < 14 then
      raise exception 'Schüler müssen mindestens 14 Jahre alt sein.';
    end if;
    if new.role in ('client', 'parent') and a < 18 then
      raise exception 'Auftraggeber und Eltern müssen volljährig sein.';
    end if;
    if a > 120 then
      raise exception 'Ungültiges Geburtsdatum.';
    end if;
    -- Felder, die der Nutzer nicht selbst setzen darf
    new.is_admin := false;
    new.is_suspended := false;
    new.verification_status := 'none';
    new.parent_id := null;
    if new.role = 'student' then
      new.parent_consent := case when a >= 18 then 'not_required' else 'pending' end;
      new.parent_link_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    else
      new.parent_consent := 'not_required';
      new.parent_link_code := null;
    end if;
  else
    -- Geschützte Felder dürfen nur über Admin-/RPC-Funktionen geändert werden.
    if not privileged then
      new.role := old.role;
      new.birth_date := old.birth_date;
      new.is_admin := old.is_admin;
      new.is_suspended := old.is_suspended;
      new.verification_status := case
        when old.verification_status in ('none', 'rejected') and new.verification_status = 'requested'
          then 'requested'
        else old.verification_status end;
      new.parent_id := old.parent_id;
      new.parent_consent := old.parent_consent;
      new.parent_link_code := old.parent_link_code;
      new.accepted_terms_at := old.accepted_terms_at;
    end if;
  end if;

  if public.contains_contact_data(new.bio) or public.contains_contact_data(new.availability_note) then
    raise exception 'Bitte keine Telefonnummern, E-Mail-Adressen oder Messenger-Namen im Profil angeben. Kontakt läuft über den Chat in der App.';
  end if;
  return new;
end $$;

create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;

create or replace function public.my_parent_id()
returns uuid language sql stable security definer set search_path = public as $$
  select parent_id from public.profiles where id = auth.uid()
$$;

create policy "profil: selbst, eltern, admin lesen" on public.profiles for select
  using (id = auth.uid() or public.is_parent_of(id) or public.is_admin()
         or id = public.my_parent_id());

create policy "profil: selbst anlegen" on public.profiles for insert
  with check (id = auth.uid());

create policy "profil: selbst ändern" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- Blockieren
-- ---------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;
create policy "blocks: eigene" on public.blocks for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- ---------------------------------------------------------------------
-- Angebote der Schüler
-- ---------------------------------------------------------------------

create table public.offers (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  category    text not null check (category in (
                'nachhilfe', 'musik', 'garten', 'fenster', 'einkaufen',
                'haushalt', 'haustiere', 'technik', 'babysitting', 'sonstiges')),
  title       text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 1000),
  price_min   numeric(6,2) not null check (price_min >= 0),
  price_max   numeric(6,2) not null,
  price_unit  text not null default 'stunde' check (price_unit in ('stunde', 'auftrag')),
  created_at  timestamptz not null default now(),
  check (price_max >= price_min and price_max <= 200)
);

create index offers_student_idx on public.offers (student_id);
create index offers_category_idx on public.offers (category);

create or replace function public.offers_guard()
returns trigger language plpgsql as $$
begin
  if (select role from public.profiles where id = new.student_id) <> 'student' then
    raise exception 'Nur Schüler können Angebote erstellen.';
  end if;
  if public.contains_contact_data(new.title) or public.contains_contact_data(new.description) then
    raise exception 'Bitte keine Kontaktdaten im Angebot angeben.';
  end if;
  return new;
end $$;

create trigger offers_guard before insert or update on public.offers
  for each row execute function public.offers_guard();

-- Ist ein Schüler öffentlich sichtbar?
create or replace function public.student_is_visible(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = sid and role = 'student' and is_listed and not is_suspended
      and parent_consent in ('approved', 'not_required')
  ) and not public.is_blocked_between(sid, auth.uid())
$$;

alter table public.offers enable row level security;
create policy "angebote: sichtbare lesen" on public.offers for select
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_admin()
         or (auth.uid() is not null and public.student_is_visible(student_id)));
create policy "angebote: eigene verwalten" on public.offers for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------------------------------------------------------------------
-- Aufträge
-- ---------------------------------------------------------------------

create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.profiles(id) on delete cascade,
  student_id       uuid not null references public.profiles(id) on delete cascade,
  offer_id         uuid references public.offers(id) on delete set null,
  category         text not null,
  description      text not null check (char_length(description) between 5 and 2000),
  scheduled_start  timestamptz not null,
  duration_minutes int not null check (duration_minutes between 15 and 480),
  agreed_price     numeric(7,2) check (agreed_price >= 0),
  payment_method   text not null default 'bar' check (payment_method in ('bar', 'paypal', 'ueberweisung')),
  status           text not null default 'requested'
                     check (status in ('requested', 'accepted', 'declined', 'cancelled', 'completed')),
  cancelled_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index jobs_client_idx on public.jobs (client_id);
create index jobs_student_idx on public.jobs (student_id);

-- Arbeitszeit-Regeln (JArbSchG, vereinfacht und bewusst streng):
--  * unter 15 Jahren oder vollzeitschulpflichtig: nur 8–18 Uhr, max. 2 Std. pro Tag
--  * 15–17 Jahre, nicht mehr vollzeitschulpflichtig: nur 6–20 Uhr, max. 8 Std. pro Tag
--  * ab 18: keine Einschränkung durch die App
create or replace function public.check_work_time(
  sid uuid, start_at timestamptz, minutes int, ignore_job uuid default null)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  local_start timestamp := start_at at time zone 'Europe/Berlin';
  local_end   timestamp := (start_at + make_interval(mins => minutes)) at time zone 'Europe/Berlin';
  a int;
  min_hour int; max_hour int; max_minutes int;
  booked int;
begin
  select * into p from public.profiles where id = sid;
  a := public.age_on(p.birth_date, local_start::date);
  if a >= 18 then return; end if;

  if a < 15 or p.full_time_school then
    min_hour := 8; max_hour := 18; max_minutes := 120;
  else
    min_hour := 6; max_hour := 20; max_minutes := 480;
  end if;

  if local_start::date <> local_end::date
     or extract(hour from local_start) < min_hour
     or local_end > date_trunc('day', local_end) + make_interval(hours => max_hour) then
    raise exception 'Jugendschutz: Dieser Schüler darf nur zwischen % und % Uhr arbeiten.', min_hour, max_hour;
  end if;

  select coalesce(sum(duration_minutes), 0) into booked
  from public.jobs
  where student_id = sid and status = 'accepted'
    and (id <> ignore_job or ignore_job is null)
    and (scheduled_start at time zone 'Europe/Berlin')::date = local_start::date;

  if booked + minutes > max_minutes then
    raise exception 'Jugendschutz: Maximal % Minuten Arbeit pro Tag (bereits gebucht: % Minuten).', max_minutes, booked;
  end if;
end $$;

create or replace function public.jobs_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  client public.profiles;
begin
  -- Interne Admin-/Eltern-Funktionen dürfen Status direkt setzen.
  if tg_op = 'UPDATE' and coalesce(current_setting('app.privileged', true), '') = 'on' then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    select * into client from public.profiles where id = new.client_id;
    if client.role <> 'client' then
      raise exception 'Nur Auftraggeber können Anfragen senden.';
    end if;
    if client.verification_status <> 'verified' then
      raise exception 'Bitte lass dein Konto zuerst verifizieren, bevor du Anfragen sendest.';
    end if;
    if client.is_suspended then
      raise exception 'Dein Konto ist gesperrt.';
    end if;
    if not public.student_is_visible(new.student_id) then
      raise exception 'Dieser Schüler ist nicht verfügbar.';
    end if;
    if new.scheduled_start < now() then
      raise exception 'Der Termin liegt in der Vergangenheit.';
    end if;
    if public.contains_contact_data(new.description) then
      raise exception 'Bitte keine Kontaktdaten in die Beschreibung schreiben.';
    end if;
    new.status := 'requested';
    new.completed_at := null;
    new.cancelled_by := null;
    perform public.check_work_time(new.student_id, new.scheduled_start, new.duration_minutes);
    return new;
  end if;

  -- UPDATE: nur der Status darf sich ändern, und nur nach festen Regeln.
  if new.client_id <> old.client_id or new.student_id <> old.student_id
     or new.category <> old.category or new.description <> old.description
     or new.scheduled_start <> old.scheduled_start or new.duration_minutes <> old.duration_minutes
     or new.agreed_price is distinct from old.agreed_price
     or new.payment_method <> old.payment_method then
    raise exception 'Auftragsdetails können nach dem Absenden nicht mehr geändert werden.';
  end if;

  if new.status <> old.status then
    if old.status = 'requested' and new.status in ('accepted', 'declined') and me = old.student_id then
      if new.status = 'accepted' then
        perform public.check_work_time(old.student_id, old.scheduled_start, old.duration_minutes, old.id);
      end if;
    elsif old.status in ('requested', 'accepted') and new.status = 'cancelled'
          and (me in (old.client_id, old.student_id) or public.is_parent_of(old.student_id)) then
      new.cancelled_by := me;
    elsif old.status = 'accepted' and new.status = 'completed' and me = old.client_id then
      new.completed_at := now();
    else
      raise exception 'Statuswechsel von % nach % ist nicht erlaubt.', old.status, new.status;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger jobs_guard before insert or update on public.jobs
  for each row execute function public.jobs_guard();

alter table public.jobs enable row level security;
create policy "aufträge: beteiligte lesen" on public.jobs for select
  using (auth.uid() in (client_id, student_id) or public.is_parent_of(student_id) or public.is_admin());
create policy "aufträge: auftraggeber erstellt" on public.jobs for insert
  with check (client_id = auth.uid());
create policy "aufträge: beteiligte ändern" on public.jobs for update
  using (auth.uid() in (client_id, student_id) or public.is_parent_of(student_id));

-- Adresse – getrennt, damit der Schüler sie erst nach Annahme sieht.
create table public.job_addresses (
  job_id      uuid primary key references public.jobs(id) on delete cascade,
  street      text not null check (char_length(street) between 3 and 120),
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  city        text not null,
  notes       text check (char_length(notes) <= 500)
);

alter table public.job_addresses enable row level security;
create policy "adresse: lesen" on public.job_addresses for select using (
  exists (
    select 1 from public.jobs j where j.id = job_id and (
      j.client_id = auth.uid() or public.is_admin()
      or ((j.student_id = auth.uid() or public.is_parent_of(j.student_id))
          and j.status in ('accepted', 'completed'))
    )
  )
);
create policy "adresse: auftraggeber anlegen" on public.job_addresses for insert with check (
  exists (select 1 from public.jobs j where j.id = job_id and j.client_id = auth.uid() and j.status = 'requested')
);

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
  if j.status in ('declined', 'cancelled') then
    raise exception 'Dieser Auftrag ist beendet – der Chat ist geschlossen.';
  end if;
  if public.is_blocked_between(j.client_id, j.student_id) then
    raise exception 'Nachricht kann nicht gesendet werden.';
  end if;
  if public.contains_contact_data(new.body) then
    raise exception 'Aus Sicherheitsgründen sind Telefonnummern, E-Mail-Adressen und Messenger-Namen im Chat nicht erlaubt.';
  end if;
  new.created_at := now();
  return new;
end $$;

create trigger messages_guard before insert on public.messages
  for each row execute function public.messages_guard();

alter table public.messages enable row level security;
create policy "chat: lesen" on public.messages for select using (
  exists (select 1 from public.jobs j where j.id = job_id and (
    auth.uid() in (j.client_id, j.student_id) or public.is_parent_of(j.student_id) or public.is_admin()))
);
create policy "chat: schreiben" on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.jobs j where j.id = job_id and auth.uid() in (j.client_id, j.student_id))
);

-- ---------------------------------------------------------------------
-- Bewertungen
-- ---------------------------------------------------------------------

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  unique (job_id, reviewer_id)
);

create index reviews_reviewee_idx on public.reviews (reviewee_id);

create or replace function public.reviews_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = new.job_id;
  if j.status <> 'completed' then
    raise exception 'Bewertungen sind erst nach Abschluss des Auftrags möglich.';
  end if;
  if new.reviewer_id = j.client_id then
    new.reviewee_id := j.student_id;
  elsif new.reviewer_id = j.student_id then
    new.reviewee_id := j.client_id;
  else
    raise exception 'Nur Beteiligte können bewerten.';
  end if;
  if public.contains_contact_data(new.comment) then
    raise exception 'Bitte keine Kontaktdaten in Bewertungen.';
  end if;
  return new;
end $$;

create trigger reviews_guard before insert on public.reviews
  for each row execute function public.reviews_guard();

alter table public.reviews enable row level security;
create policy "bewertungen: lesen" on public.reviews for select using (auth.uid() is not null);
create policy "bewertungen: schreiben" on public.reviews for insert with check (reviewer_id = auth.uid());

-- ---------------------------------------------------------------------
-- Meldungen
-- ---------------------------------------------------------------------

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  job_id           uuid references public.jobs(id) on delete set null,
  reason           text not null check (reason in (
                     'belaestigung', 'unangemessen', 'betrug', 'gefahr', 'fake_profil', 'sonstiges')),
  details          text check (char_length(details) <= 2000),
  status           text not null default 'open' check (status in ('open', 'resolved')),
  admin_note       text,
  created_at       timestamptz not null default now()
);

alter table public.reports enable row level security;
create policy "meldungen: eigene lesen" on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());
create policy "meldungen: erstellen" on public.reports for insert
  with check (reporter_id = auth.uid() and status = 'open' and admin_note is null);
create policy "meldungen: admin bearbeitet" on public.reports for update
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- Öffentliche Profil-Ansicht (nur unkritische Felder!)
-- Läuft mit Rechten des Eigentümers, filtert aber selbst nach Sichtbarkeit.
-- ---------------------------------------------------------------------

create or replace view public.public_profiles
with (security_invoker = false) as
select
  p.id,
  p.role,
  p.first_name || ' ' || left(p.last_name, 1) || '.' as display_name,
  public.age_on(p.birth_date, current_date) as age,
  p.city,
  p.postal_code,
  p.radius_km,
  p.bio,
  p.availability_note,
  p.verification_status = 'verified' as is_verified,
  (p.parent_consent in ('approved', 'not_required')) as has_parent_consent,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.reviewee_id = p.id) as avg_rating,
  (select count(*) from public.reviews r where r.reviewee_id = p.id)::int as review_count,
  (select count(*) from public.jobs j where j.student_id = p.id and j.status = 'completed')::int as completed_jobs,
  -- Erlaubte Arbeitszeiten (gleiche Logik wie check_work_time), damit die App sie anzeigen kann
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
    p.id = auth.uid()
    or public.is_admin()
    or public.is_parent_of(p.id)
    or (p.role = 'student' and public.student_is_visible(p.id))
    -- Gegenüber in einem gemeinsamen Auftrag
    or exists (select 1 from public.jobs j
               where (j.client_id = p.id and (j.student_id = auth.uid() or public.is_parent_of(j.student_id)))
                  or (j.student_id = p.id and j.client_id = auth.uid()))
  );

revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- ---------------------------------------------------------------------
-- RPC-Funktionen
-- ---------------------------------------------------------------------

-- Elternteil verknüpft sich über den Code, den das Kind in der App sieht.
create or replace function public.link_child(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare child public.profiles; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.role is distinct from 'parent' then
    raise exception 'Nur Eltern-Konten können Kinder verknüpfen.';
  end if;
  select * into child from public.profiles
    where parent_link_code = upper(trim(code)) and role = 'student';
  if child.id is null then
    raise exception 'Code nicht gefunden.';
  end if;
  if child.parent_id is not null and child.parent_id <> me.id then
    raise exception 'Dieses Konto ist bereits mit einem anderen Elternteil verknüpft.';
  end if;
  perform set_config('app.privileged', 'on', true);
  update public.profiles set parent_id = me.id where id = child.id;
  perform set_config('app.privileged', 'off', true);
  return child.id;
end $$;

-- Elternteil erteilt oder entzieht die Zustimmung.
create or replace function public.set_parent_consent(child uuid, approved boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent_of(child) then
    raise exception 'Keine Berechtigung.';
  end if;
  perform set_config('app.privileged', 'on', true);
  update public.profiles
     set parent_consent = case when approved then 'approved' else 'rejected' end,
         is_listed = case when approved then is_listed else false end
   where id = child and parent_consent <> 'not_required';
  -- Bei Widerruf: offene Anfragen automatisch ablehnen
  if not approved then
    update public.jobs set status = 'declined', updated_at = now()
     where student_id = child and status = 'requested';
  end if;
  perform set_config('app.privileged', 'off', true);
end $$;

-- Admin: Verifizierung setzen
create or replace function public.admin_set_verification(target uuid, status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung.'; end if;
  if status not in ('verified', 'rejected', 'none') then raise exception 'Ungültiger Status.'; end if;
  perform set_config('app.privileged', 'on', true);
  update public.profiles set verification_status = status where id = target;
  perform set_config('app.privileged', 'off', true);
end $$;

-- Admin: Konto sperren / entsperren
create or replace function public.admin_set_suspended(target uuid, suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung.'; end if;
  perform set_config('app.privileged', 'on', true);
  update public.profiles set is_suspended = suspended where id = target;
  if suspended then
    update public.jobs set status = 'cancelled', updated_at = now()
     where (client_id = target or student_id = target) and status in ('requested', 'accepted');
  end if;
  perform set_config('app.privileged', 'off', true);
end $$;

-- Admin: Liste offener Verifizierungen (mit vollem Namen, nur für Admins)
create or replace function public.admin_pending_verifications()
returns table (id uuid, role text, first_name text, last_name text, phone text, city text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung.'; end if;
  return query
    select p.id, p.role, p.first_name, p.last_name, p.phone, p.city, p.created_at
    from public.profiles p where p.verification_status = 'requested' order by p.created_at;
end $$;

-- Eigene Blockliste mit Anzeigenamen (die View blendet Blockierte ja aus)
create or replace function public.my_blocked_users()
returns table (id uuid, display_name text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name || ' ' || left(p.last_name, 1) || '.', b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc
$$;

-- Konto löschen (Pflicht laut App-Store-Richtlinien)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.delete_my_account() from anon;
revoke execute on function public.my_blocked_users() from anon;
revoke execute on function public.admin_set_verification(uuid, text) from anon;
revoke execute on function public.admin_set_suspended(uuid, boolean) from anon;
revoke execute on function public.admin_pending_verifications() from anon;
revoke execute on function public.link_child(text) from anon;
revoke execute on function public.set_parent_consent(uuid, boolean) from anon;

-- Realtime für den Chat und Auftragsstatus
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
    alter publication supabase_realtime add table public.jobs;
  end if;
end $$;
