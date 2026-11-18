-- Tests der Sicherheitsregeln. Ausführen mit: supabase/tests/run_local.sh
\set ON_ERROR_STOP 1

create schema test;
grant usage on schema test to authenticated;

create function test.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;

-- Führt SQL aus und erwartet einen Fehler, dessen Text `pattern` enthält.
create function test.throws(stmt text, pattern text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm ilike '%' || pattern || '%' then
      raise notice 'OK (Fehler erwartet): %', sqlerrm;
      return;
    end if;
    raise exception 'FALSCHER FEHLER bei [%]: % (erwartet: %)', stmt, sqlerrm, pattern;
  end;
  raise exception 'KEIN FEHLER bei [%] (erwartet: %)', stmt, pattern;
end $$;

create function test.eq(actual bigint, expected bigint, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FEHLGESCHLAGEN: % – erwartet %, erhalten %', label, expected, actual;
  end if;
  raise notice 'OK: %', label;
end $$;

grant execute on all functions in schema test to authenticated;

-- IDs
\set admin  '''00000000-0000-0000-0000-00000000000a'''
\set c1     '''00000000-0000-0000-0000-0000000000c1'''
\set c2     '''00000000-0000-0000-0000-0000000000c2'''
\set s1     '''00000000-0000-0000-0000-0000000000b1'''
\set s2     '''00000000-0000-0000-0000-0000000000b2'''
\set p1     '''00000000-0000-0000-0000-0000000000d1'''

insert into auth.users (id) values (:admin), (:c1), (:c2), (:s1), (:s2), (:p1), ('00000000-0000-0000-0000-0000000000e1');

-- ------------------------------------------------------------ Registrierung
set role authenticated;

select test.login(:admin);
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at, is_admin)
values (:admin, 'client', 'Ada', 'Admin', '1980-01-01', 'Musterstadt', '12345', now(), true);
select test.eq((select is_admin::int from profiles where id = :admin), 0, 'is_admin kann nicht selbst gesetzt werden');

select test.login(:c1);
insert into profiles (id, role, first_name, last_name, birth_date, phone, city, postal_code, accepted_terms_at)
values (:c1, 'client', 'Karl', 'Kunde', '1970-05-05', '0170 1234567', 'Musterstadt', '12345', now());

select test.login(:c2);
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at)
values (:c2, 'client', 'Uwe', 'Unverifiziert', '1975-05-05', 'Musterstadt', '12345', now());

select test.login(:s1);
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, bio, accepted_terms_at)
values (:s1, 'student', 'Lena', 'Müller', current_date - interval '15 years 2 months', 'Musterstadt', '12345', 'Ich helfe gern im Garten.', now());
insert into offers (student_id, category, title, price_min, price_max)
values (:s1, 'garten', 'Rasen mähen', 8, 12);
select test.throws($$update profiles set bio = 'Schreib mir: 0170 / 123 45 67' where id = auth.uid()$$, 'Telefonnummern');
select test.throws($$update profiles set bio = 'lena@example.de' where id = auth.uid()$$, 'E-Mail');
select test.throws($$insert into offers (student_id, category, title, price_min, price_max) values (auth.uid(), 'garten', 'Hecke', 20, 10)$$, 'check');

select test.login(:s2);
select test.throws($$insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at)
  values (auth.uid(), 'student', 'Tim', 'Klein', current_date - interval '13 years', 'Musterstadt', '12345', now())$$, 'mindestens 14');
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at, full_time_school)
values (:s2, 'student', 'Tom', 'Groß', current_date - interval '17 years', 'Musterstadt', '12345', now(), false);

select test.login('00000000-0000-0000-0000-0000000000e1');
select test.throws($$insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at)
  values (auth.uid(), 'client', 'Jung', 'Kunde', current_date - interval '16 years', 'Musterstadt', '12345', now())$$, 'volljährig');

select test.login(:p1);
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at)
values (:p1, 'parent', 'Petra', 'Müller', '1985-03-03', 'Musterstadt', '12345', now());

-- ------------------------------------------------------------ Datenschutz
select test.login(:c1);
select test.eq((select count(*) from profiles), 1, 'Auftraggeber sieht nur eigenes privates Profil');
select test.eq((select count(*) from public_profiles where role = 'student'), 0, 'Schüler ohne Eltern-Zustimmung unsichtbar');

-- Selbst ändern geschützter Felder wird ignoriert
select test.login(:s1);
update profiles set parent_consent = 'approved', is_admin = true, role = 'client' where id = auth.uid();
select test.eq((select (parent_consent = 'pending' and not is_admin and role = 'student')::int from profiles where id = auth.uid()), 1, 'Schüler kann Zustimmung/Rolle nicht selbst setzen');

-- ------------------------------------------------------------ Eltern
select test.login(:c1);
select test.throws($$select link_child((select parent_link_code from profiles limit 1))$$, 'Nur Eltern');

reset role;
select test.login(null);
select parent_link_code as code from profiles where id = :s1 \gset
set role authenticated;

select test.login(:p1);
select test.throws($$select link_child('FALSCH00')$$, 'nicht gefunden');
select link_child(:'code') is not null as linked;
select test.eq((select count(*) from profiles where id = :s1), 1, 'Elternteil sieht Profil des Kindes');
select set_parent_consent(:s1, true);
select test.throws(format('select set_parent_consent(%L, true)', :s2), 'Keine Berechtigung');

select test.login(:s1);
select test.eq((select count(*) from profiles where id = :p1), 1, 'Kind sieht Profil des Elternteils');

select test.login(:c1);
select test.eq((select count(*) from public_profiles where role = 'student'), 1, 'Nach Eltern-Zustimmung sichtbar (17-Jähriger ohne Zustimmung nicht)');
select test.eq((select count(*) from public_profiles where display_name = 'Lena M.' and age = 15), 1, 'Öffentlich nur Vorname + Initial und Alter');
select test.eq((select count(*) from offers), 1, 'Angebote sichtbarer Schüler lesbar');


-- ------------------------------------------------------------ Verifizierung
select test.login(:c2);
select test.throws(format($$insert into jobs (client_id, student_id, category, description, scheduled_start, duration_minutes)
  values (auth.uid(), %L, 'garten', 'Rasen mähen bitte', (current_date + 3) + time '10:00', 60)$$, :s1), 'verifizieren');
update profiles set verification_status = 'verified' where id = auth.uid();
select test.eq((select (verification_status = 'none')::int from profiles where id = auth.uid()), 1, 'Nutzer kann sich nicht selbst verifizieren');

select test.login(:c1);
update profiles set verification_status = 'requested' where id = auth.uid();
select test.throws(format('select admin_set_verification(%L, %L)', :c1, 'verified'), 'Keine Berechtigung');

reset role;
select test.login(null);
update profiles set is_admin = true where id = :admin;  -- Admin wird im Supabase-Dashboard gesetzt
set role authenticated;
select test.login(:admin);
select test.eq((select count(*) from admin_pending_verifications()), 1, 'Admin sieht offene Verifizierung');
select admin_set_verification(:c1, 'verified');

-- ------------------------------------------------------------ Aufträge + Jugendschutz
select test.login(:c1);
select test.throws(format($$insert into jobs (client_id, student_id, category, description, scheduled_start, duration_minutes)
  values (auth.uid(), %L, 'garten', 'Abends Rasen mähen', ((current_date + 3) + time '17:30') at time zone 'Europe/Berlin', 60)$$, :s1), 'zwischen 8 und 18');
select test.throws(format($$insert into jobs (client_id, student_id, category, description, scheduled_start, duration_minutes)
  values (auth.uid(), %L, 'garten', 'Ganzer Tag Garten', ((current_date + 3) + time '09:00') at time zone 'Europe/Berlin', 180)$$, :s1), 'Maximal 120');
select test.throws(format($$insert into jobs (client_id, student_id, category, description, scheduled_start, duration_minutes)
  values (auth.uid(), %L, 'garten', 'Ruf an 0170 1234567', ((current_date + 3) + time '09:00') at time zone 'Europe/Berlin', 60)$$, :s1), 'Kontaktdaten');
select test.throws(format($$insert into jobs (client_id, student_id, category, description, scheduled_start, duration_minutes)
  values (auth.uid(), %L, 'garten', 'Rasen mähen', ((current_date + 3) + time '09:00') at time zone 'Europe/Berlin', 60)$$, :s2), 'nicht verfügbar');

insert into jobs (id, client_id, student_id, category, description, scheduled_start, duration_minutes, agreed_price)
values ('10000000-0000-0000-0000-000000000001', :c1, :s1, 'garten', 'Rasen mähen, ca. 200 m²',
        ((current_date + 3) + time '10:00') at time zone 'Europe/Berlin', 90, 15);
insert into job_addresses (job_id, street, postal_code, city) values ('10000000-0000-0000-0000-000000000001', 'Gartenweg 5', '12345', 'Musterstadt');
insert into jobs (id, client_id, student_id, category, description, scheduled_start, duration_minutes)
values ('10000000-0000-0000-0000-000000000002', :c1, :s1, 'garten', 'Hecke schneiden',
        ((current_date + 3) + time '14:00') at time zone 'Europe/Berlin', 60);

select test.throws($$update jobs set status = 'accepted' where id = '10000000-0000-0000-0000-000000000001'$$, 'nicht erlaubt');
select test.throws($$update jobs set agreed_price = 1 where id = '10000000-0000-0000-0000-000000000001'$$, 'nicht mehr geändert');

select test.login(:s1);
select test.eq((select count(*) from job_addresses), 0, 'Schüler sieht Adresse vor Annahme nicht');
update jobs set status = 'accepted' where id = '10000000-0000-0000-0000-000000000001';
select test.eq((select count(*) from job_addresses), 1, 'Schüler sieht Adresse nach Annahme');
select test.throws($$update jobs set status = 'accepted' where id = '10000000-0000-0000-0000-000000000002'$$, 'pro Tag');
select test.throws($$update jobs set status = 'completed' where id = '10000000-0000-0000-0000-000000000001'$$, 'nicht erlaubt');

select test.login(:c2);
select test.eq((select count(*) from jobs), 0, 'Fremde sehen keine Aufträge');

-- ------------------------------------------------------------ Chat
select test.login(:s1);
insert into messages (job_id, sender_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Hallo, ich komme um 10 Uhr!');
select test.throws($$insert into messages (job_id, sender_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Meine Nummer: +49 170 123 4567')$$, 'Telefonnummern');
select test.throws($$insert into messages (job_id, sender_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Schreib mir auf WhatsApp')$$, 'Messenger');
select test.login(:c2);
select test.throws($$insert into messages (job_id, sender_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Hi')$$, 'row-level security');
select test.login(:p1);
select test.eq((select count(*) from messages), 1, 'Elternteil kann Chat des Kindes lesen');
select test.eq((select count(*) from jobs), 2, 'Elternteil sieht Aufträge des Kindes');

-- ------------------------------------------------------------ Abschluss + Bewertung
select test.login(:c1);
select test.throws($$insert into reviews (job_id, reviewer_id, reviewee_id, rating) values ('10000000-0000-0000-0000-000000000002', auth.uid(), auth.uid(), 5)$$, 'nach Abschluss');
update jobs set status = 'completed' where id = '10000000-0000-0000-0000-000000000001';
insert into reviews (job_id, reviewer_id, reviewee_id, rating, comment)
values ('10000000-0000-0000-0000-000000000001', auth.uid(), auth.uid(), 5, 'Super zuverlässig!');
select test.eq((select count(*) from reviews where reviewee_id = :s1), 1, 'Bewertung wird dem Schüler zugeordnet');
select test.eq((select avg_rating::int from public_profiles where id = :s1), 5, 'Durchschnittsbewertung');
select test.throws($$insert into reviews (job_id, reviewer_id, reviewee_id, rating) values ('10000000-0000-0000-0000-000000000001', auth.uid(), auth.uid(), 1)$$, 'duplicate');

select test.login(:s1);
select test.eq((select count(*) from public_profiles where id = :c1), 1, 'Schüler sieht Profil seines Auftraggebers');

-- ------------------------------------------------------------ Eltern sagen ab, Blockieren, Melden
select test.login(:p1);
update jobs set status = 'cancelled' where id = '10000000-0000-0000-0000-000000000002';
select test.eq((select count(*) from jobs where status = 'cancelled' and cancelled_by = :p1), 1, 'Elternteil kann Auftrag absagen');

select test.login(:s1);
insert into blocks (blocker_id, blocked_id) values (auth.uid(), :c1);
select test.eq((select count(*) from my_blocked_users() where display_name = 'Karl K.'), 1, 'Blockliste zeigt Namen');
insert into reports (reporter_id, reported_user_id, reason, details) values (auth.uid(), :c1, 'unangemessen', 'Test');
select test.throws($$insert into reports (reporter_id, reported_user_id, reason, status) values (auth.uid(), auth.uid(), 'sonstiges', 'resolved')$$, 'row-level security');
select test.login(:c1);
select test.eq((select count(*) from public_profiles where role = 'student'), 0, 'Blockierter Auftraggeber findet Schüler nicht mehr');
select test.eq((select count(*) from reports), 0, 'Gemeldeter sieht Meldung nicht');
select test.login(:admin);
select test.eq((select count(*) from reports), 1, 'Admin sieht Meldungen');
select admin_set_suspended(:c1, true);

-- ------------------------------------------------------------ Widerruf der Zustimmung
select test.login(:p1);
select set_parent_consent(:s1, false);
select test.login(:c2);
select test.eq((select count(*) from public_profiles where role = 'student'), 0, 'Nach Widerruf unsichtbar');

-- ------------------------------------------------------------ Konto löschen
select test.login(:s1);
select delete_my_account();
reset role;
select test.eq((select count(*) from profiles where id = :s1), 0, 'Konto gelöscht');
select test.eq((select count(*) from auth.users where id = :s1), 0, 'Auth-Nutzer gelöscht');

\echo 'ALLE TESTS BESTANDEN'
