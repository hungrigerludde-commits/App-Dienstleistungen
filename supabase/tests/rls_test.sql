-- Tests der Sicherheitsregeln und Abläufe. Ausführen mit: supabase/tests/run_local.sh
\set ON_ERROR_STOP 1

create schema test;
grant usage on schema test to authenticated;
create function test.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;
create function test.throws(stmt text, pattern text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm ilike '%' || pattern || '%' then raise notice 'OK (Fehler erwartet): %', sqlerrm; return; end if;
    raise exception 'FALSCHER FEHLER bei [%]: % (erwartet: %)', stmt, sqlerrm, pattern;
  end;
  raise exception 'KEIN FEHLER bei [%] (erwartet: %)', stmt, pattern;
end $$;
create function test.eq(actual anyelement, expected anyelement, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FEHLGESCHLAGEN: % – erwartet %, erhalten %', label, expected, actual;
  end if;
  raise notice 'OK: %', label;
end $$;
grant execute on all functions in schema test to authenticated;

\set admin '''00000000-0000-0000-0000-00000000000a'''
\set c1    '''00000000-0000-0000-0000-0000000000c1'''
\set c2    '''00000000-0000-0000-0000-0000000000c2'''
\set s1    '''00000000-0000-0000-0000-0000000000b1'''
\set s2    '''00000000-0000-0000-0000-0000000000b2'''
\set p1    '''00000000-0000-0000-0000-0000000000d1'''
\set x1    '''00000000-0000-0000-0000-0000000000e1'''

insert into auth.users (id) values (:admin), (:c1), (:c2), (:s1), (:s2), (:p1), (:x1);

-- Termin übermorgen 10:00 / 17:30 deutscher Zeit
select (((current_date + 2) + time '10:00') at time zone 'Europe/Berlin') as t10 \gset
select (((current_date + 2) + time '17:30') at time zone 'Europe/Berlin') as t1730 \gset
select (((current_date + 3) + time '14:00') at time zone 'Europe/Berlin') as t14 \gset

-- ================================================================ Registrierung
set role authenticated;
select test.login(:admin);
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at, is_admin, verification_status)
values (:admin, 'client', 'Ada', 'Admin', '1980-01-01', 'Musterstadt', '12345', now(), true, 'verified');
select test.eq((select (is_admin or verification_status = 'verified') from profiles where id = :admin), false, 'Admin/Verifiziert kann man nicht selbst setzen');

select test.login(:c1);
insert into profiles (id, role, first_name, last_name, birth_date, phone, city, postal_code, accepted_terms_at)
values (:c1, 'client', 'Karl', 'Kunde', '1970-05-05', '0170 1234567', 'Musterstadt', '12345', now());
select test.login(:c2);
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at)
values (:c2, 'client', 'Uwe', 'Unverifiziert', '1975-05-05', 'Musterstadt', '12345', now());
select test.login(:s1);
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at)
values (:s1, 'student', 'Lena', 'Müller', current_date - interval '15 years 2 months', 'Musterstadt', '12345', now());
select test.login(:s2);
insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at, full_time_school)
values (:s2, 'student', 'Tom', 'Groß', current_date - interval '17 years', 'Musterstadt', '12345', now(), false);
select test.login(:p1);
insert into profiles (id, role, first_name, last_name, birth_date, phone, city, postal_code, accepted_terms_at)
values (:p1, 'parent', 'Petra', 'Müller', '1985-03-03', '0151 999999', 'Musterstadt', '12345', now());
select test.login(:x1);
select test.throws($$insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at)
  values (auth.uid(), 'student', 'Tim', 'Klein', current_date - interval '13 years', 'Musterstadt', '12345', now())$$, 'ERR_MIN_AGE_14');
select test.throws($$insert into profiles (id, role, first_name, last_name, birth_date, city, postal_code, accepted_terms_at)
  values (auth.uid(), 'client', 'Jung', 'Kunde', current_date - interval '16 years', 'Musterstadt', '12345', now())$$, 'ERR_MIN_AGE_18');

-- ================================================================ Ausweis-Prüfung
select test.login(:c2);
select test.throws($$insert into job_posts (client_id, service, title, description, price_min, price_max, scheduled_start, duration_minutes, approx_lat, approx_lng, city, postal_code)
  values (auth.uid(), 'rasen', 'Rasen', 'Rasen mähen bitte', 10, 15, now() + interval '2 days', 60, 52.52, 13.40, 'Musterstadt', '12345')$$, 'ERR_VERIFY_FIRST');
update profiles set verification_status = 'verified' where id = auth.uid();
select test.eq((select verification_status from profiles where id = auth.uid()), 'none', 'Selbst-Verifizierung wird ignoriert');

select test.login(:c1);
insert into verifications (user_id, doc_type, front_path, back_path, selfie_path)
values (auth.uid(), 'personalausweis', :c1 || '/front.jpg', :c1 || '/back.jpg', :c1 || '/selfie.jpg');
select test.eq((select verification_status from profiles where id = auth.uid()), 'pending', 'Ausweis hochgeladen → wird geprüft');
select test.throws(format('select admin_review_verification(%L, true)', (select id from verifications limit 1)), 'ERR_NOT_ALLOWED');

reset role; select test.login(null);
update profiles set is_admin = true where id = :admin;  -- Admin wird im Supabase-Dashboard gesetzt
set role authenticated;

select test.login(:admin);
select test.eq((select count(*) from verifications where status = 'pending'), 1::bigint, 'Admin sieht offene Prüfung');
select admin_review_verification((select id from verifications where user_id = :c1), true);
select test.eq((select verification_status from profiles where id = :c1), 'verified', 'Admin verifiziert Auftraggeber');
select test.eq((select front_path from verifications where user_id = :c1), null::text, 'Ausweis-Pfade nach Prüfung entfernt');

select test.login(:c1);
update profiles set last_name = 'Anders' where id = auth.uid();
select test.eq((select last_name from profiles where id = auth.uid()), 'Kunde', 'Name nach Verifizierung nicht änderbar');

-- ================================================================ Gesuch anlegen
select test.login(:c1);
insert into job_posts (id, client_id, service, title, description, price_min, price_max, price_unit, scheduled_start, duration_minutes, approx_lat, approx_lng, city, postal_code)
values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'rasen', 'Rasen mähen', 'Ca. 150 m², Mäher vorhanden', 10, 14, 'stunde', :'t10', 90, 52.52437, 13.41053, 'Musterstadt', '12345');
insert into post_addresses (post_id, street, postal_code, city, lat, lng)
values ('20000000-0000-0000-0000-000000000001', 'Gartenweg 5', '12345', 'Musterstadt', 52.52437, 13.41053);
select test.eq((select approx_lat from job_posts where id = '20000000-0000-0000-0000-000000000001'), 52.52::float8, 'Öffentlicher Ort nur gerundet');
insert into job_posts (id, client_id, service, title, description, price_min, price_max, price_unit, scheduled_start, duration_minutes, approx_lat, approx_lng, city, postal_code)
values ('20000000-0000-0000-0000-000000000002', auth.uid(), 'rasen', 'Rasen abends', 'Abends Rasen mähen', 10, 14, 'stunde', :'t1730', 60, 52.52, 13.41, 'Musterstadt', '12345');
insert into post_addresses (post_id, street, postal_code, city, lat, lng)
values ('20000000-0000-0000-0000-000000000002', 'Gartenweg 5', '12345', 'Musterstadt', 52.52437, 13.41053);
insert into job_posts (id, client_id, service, title, description, price_min, price_max, price_unit, scheduled_start, duration_minutes, approx_lat, approx_lng, city, postal_code)
values ('20000000-0000-0000-0000-000000000003', auth.uid(), 'hecke', 'Hecke schneiden', 'Kleine Hecke vorm Haus', 25, 30, 'auftrag', :'t14', 60, 52.52, 13.41, 'Musterstadt', '12345');
insert into post_addresses (post_id, street, postal_code, city, lat, lng)
values ('20000000-0000-0000-0000-000000000003', 'Gartenweg 5', '12345', 'Musterstadt', 52.52437, 13.41053);
select test.throws($$insert into job_posts (client_id, service, title, description, price_min, price_max, scheduled_start, duration_minutes, approx_lat, approx_lng, city, postal_code)
  values (auth.uid(), 'rasen', 'Rasen', 'Ruf an 0170 1234567', 10, 15, now() + interval '2 days', 60, 52.52, 13.40, 'Musterstadt', '12345')$$, 'ERR_CONTACT_DATA');

-- ================================================================ Schüler + Eltern
select test.login(:s1);
insert into offers (student_id, service, title, price_min, price_max) values (auth.uid(), 'rasen', 'Rasen mähen', 8, 12);
insert into offers (student_id, service, title, price_min, price_max) values (auth.uid(), 'hecke', 'Hecke schneiden', 10, 14);
select test.throws($$insert into offers (student_id, service, title, price_min, price_max) values (auth.uid(), 'tagesmutter', 'Tagesmutter', 8, 10)$$, 'ERR_TAGESMUTTER_18');
update profiles set home_lat = 52.53, home_lng = 13.42, radius_km = 5 where id = auth.uid();
select test.eq((select count(*) from student_suggestions()), 0::bigint, 'Ohne Eltern-Zustimmung keine Vorschläge');

select test.login(:c1);
select test.eq((select count(*) from public_profiles where role = 'student'), 0::bigint, 'Schüler ohne Zustimmung unsichtbar');

reset role; select test.login(null);
select parent_link_code as code1 from profiles where id = :s1 \gset
select parent_link_code as code2 from profiles where id = :s2 \gset
set role authenticated;

select test.login(:p1);
select link_child(:'code1') is not null as linked;
select link_child(:'code2') is not null as linked;
select test.throws(format('select set_parent_consent(%L, true)', :s1), 'ERR_PARENT_VERIFY_FIRST');
insert into verifications (user_id, doc_type) values (auth.uid(), 'personalausweis');
select test.login(:admin);
select admin_review_verification((select id from verifications where user_id = :p1), true);
select test.login(:p1);
select set_parent_consent(:s1, true);
select set_parent_consent(:s2, true);

select test.login(:c1);
select test.eq((select count(*) from public_profiles where role = 'student'), 1::bigint, 'Nur 15-Jährige sichtbar (17-Jähriger braucht noch Ausweis)');
select test.eq((select display_name || ', ' || age from public_profiles where id = :s1), 'Lena M., 15', 'Öffentlich nur Vorname + Initial + Alter');

-- ================================================================ Vorschläge
select test.login(:s1);
select test.eq((select count(*) from student_suggestions()), 2::bigint, 'Schüler bekommt passende Gesuche (abends ausgeschlossen)');
select test.eq((select count(*) from student_suggestions() where post_id = '20000000-0000-0000-0000-000000000002'), 0::bigint, 'Gesuch um 17:30 wird 15-Jähriger nicht vorgeschlagen');
select test.eq((select distance_km from student_suggestions() where post_id = '20000000-0000-0000-0000-000000000001'), 1::float8, 'Entfernung gerundet');
select test.eq((select count(*) from map_posts()), 3::bigint, 'Karte zeigt Gesuche im Umkreis');
select test.eq((select count(*) from post_addresses), 0::bigint, 'Schüler sieht Adresse vor Zusage nicht');
update profiles set radius_km = 1 where id = auth.uid();
select test.eq((select count(*) from student_suggestions()), 0::bigint, 'Umkreis 1 km: keine Vorschläge');
update profiles set radius_km = 5 where id = auth.uid();

select test.login(:c1);
select test.eq((select count(*) from client_suggestions() where student_id = :s1), 2::bigint, 'Auftraggeber bekommt Schüler zu passenden Gesuchen');
insert into favorites (user_id, favorite_id) values (auth.uid(), :s1);
select test.eq((select is_favorite from client_suggestions() limit 1), true, 'Favorit markiert');
select test.eq((select count(*) from my_favorites()), 1::bigint, 'Favoritenliste');

-- Wischen nach links blendet aus
select test.login(:s1);
insert into swipes (user_id, target_kind, target_id, liked) values (auth.uid(), 'post', '20000000-0000-0000-0000-000000000003', false);
select test.eq((select count(*) from student_suggestions()), 1::bigint, 'Weggewischtes Gesuch verschwindet');

-- ================================================================ Bewerbung → Zusage
select test.login(:s1);
select apply_to_post('20000000-0000-0000-0000-000000000001') as job1 \gset
select test.throws(format('select apply_to_post(%L)', '20000000-0000-0000-0000-000000000001'), 'ERR_ALREADY_EXISTS');
select test.throws(format('select respond_to_job(%L, true)', :'job1'), 'ERR_NOT_ALLOWED');
select test.throws(format('select apply_to_post(%L)', '20000000-0000-0000-0000-000000000002'), 'ERR_WORK_HOURS:8:18');
select test.eq((select agreed_price from jobs where id = :'job1'), 21.00::numeric, 'Preis = Höchstpreis × Dauer');
update jobs set status = 'accepted' where id = :'job1';
select test.eq((select status from jobs where id = :'job1'), 'requested', 'Status lässt sich nicht direkt ändern');

select test.login(:c1);
select respond_to_job(:'job1', true);
select test.eq((select status from job_posts where id = '20000000-0000-0000-0000-000000000001'), 'closed', 'Gesuch nach Zusage geschlossen');

select test.login(:s1);
select test.eq((select street from post_addresses where post_id = '20000000-0000-0000-0000-000000000001'), 'Gartenweg 5', 'Schüler sieht Adresse nach Zusage');

-- Eltern wissen wo, wann, bei wem
select test.login(:p1);
select test.eq((select client_name || ' / ' || client_phone || ' / ' || street from child_jobs(:s1) where job_id = :'job1'),
               'Karl Kunde / 0170 1234567 / Gartenweg 5', 'Eltern sehen vollen Namen, Telefon und Adresse des Auftraggebers');
select test.throws(format('select * from child_jobs(%L)', :c1), 'ERR_NOT_ALLOWED');

-- ================================================================ Chat
select test.login(:s1);
insert into messages (job_id, sender_id, body) values (:'job1', auth.uid(), 'Hallo, ich komme um 10!');
select test.throws(format($$insert into messages (job_id, sender_id, body) values (%L, auth.uid(), 'Meine Nummer: +49 170 123 4567')$$, :'job1'), 'ERR_CONTACT_DATA');
select test.login(:c2);
select test.throws(format($$insert into messages (job_id, sender_id, body) values (%L, auth.uid(), 'Hi')$$, :'job1'), 'row-level security');
select test.login(:p1);
select test.eq((select count(*) from messages), 1::bigint, 'Eltern lesen den Chat mit');

-- ================================================================ Bezahlen + beidseitig fertig
select test.login(:c1);
select test.throws(format('select confirm_job_done(%L)', :'job1'), 'ERR_PAY_FIRST');
select demo_pay(:'job1', 'vivid');
select test.eq((select status || ':' || amount from payments where job_id = :'job1'), 'held:21.00', 'Zahlung treuhänderisch gehalten');
select confirm_job_done(:'job1');
select test.eq((select status from jobs where id = :'job1'), 'accepted', 'Nach einer Bestätigung noch nicht fertig');
select test.login(:s1);
select confirm_job_done(:'job1');
select test.eq((select status from jobs where id = :'job1'), 'completed', 'Beide fertig → abgeschlossen');
select test.eq((select status from payments where job_id = :'job1'), 'released', 'Zahlung freigegeben');
select test.eq((select count(*) from messages), 0::bigint, 'Chat für Schüler nach Abschluss verschwunden');
select test.login(:p1);
select test.eq((select count(*) from messages), 0::bigint, 'Chat auch für Eltern verschwunden');
select test.login(:admin);
select test.eq((select count(*) from messages), 1::bigint, 'Admin sieht Chat noch (Sicherheitsfrist)');

-- Bewertungen
select test.login(:c1);
insert into reviews (job_id, reviewer_id, reviewee_id, rating, comment) values (:'job1', auth.uid(), auth.uid(), 5, 'Super zuverlässig!');
select test.login(:s1);
insert into reviews (job_id, reviewer_id, reviewee_id, rating, comment) values (:'job1', auth.uid(), auth.uid(), 4, 'Sehr nett');
select test.eq((select avg_rating from public_profiles where id = :s1), 5::float8, 'Bewertung Schüler');
select test.eq((select avg_rating from public_profiles where id = :c1), 4::float8, 'Bewertung Auftraggeber');

-- ================================================================ Einladung durch Auftraggeber, Absage durch Eltern
select test.login(:c1);
select invite_student('20000000-0000-0000-0000-000000000003', :s1) as job2 \gset
select test.eq((select agreed_price from jobs where id = :'job2'), 30.00::numeric, 'Festpreis pro Auftrag');
select test.login(:s1);
select respond_to_job(:'job2', true);
select test.login(:c1);
select demo_pay(:'job2', 'paypal');
select test.login(:p1);
select cancel_job(:'job2');
select test.eq((select status from jobs where id = :'job2'), 'cancelled', 'Eltern können absagen');
select test.eq((select status from payments where job_id = :'job2'), 'refunded', 'Zahlung erstattet');

-- ================================================================ Fotos
select test.login(:c1);
insert into photos (owner_id, kind, post_id, storage_path) values (auth.uid(), 'post', '20000000-0000-0000-0000-000000000003', :c1 || '/rasen.jpg');
select test.throws(format($$insert into photos (owner_id, kind, post_id, storage_path) values (auth.uid(), 'post', '20000000-0000-0000-0000-000000000003', %L)$$, :s1 || '/fremd.jpg'), 'photos_check');
select test.login(:s1);
insert into photos (owner_id, kind, storage_path, caption) values (auth.uid(), 'portfolio', :s1 || '/rasen-fertig.jpg', 'Frisch gemäht');
select test.login(:c1);
select test.eq((select count(*) from photos where owner_id = :s1), 1::bigint, 'Portfolio-Fotos sichtbar');

-- ================================================================ Melden: 3 Meldungen → Sperre
select test.login(:c1);
insert into reports (reporter_id, reported_user_id, reason, details) values (auth.uid(), :c2, 'betrug', 'Test');
select test.throws(format($$insert into reports (reporter_id, reported_user_id, reason) values (auth.uid(), %L, 'betrug')$$, :c2), 'duplicate');
select test.login(:s1);
insert into reports (reporter_id, reported_user_id, reason) values (auth.uid(), :c2, 'belaestigung');
select test.eq((select count(*) from public_profiles where id = :c2), 0::bigint, 'Gemeldete sehen Meldungen nicht / unverifiziert unsichtbar');
select test.login(:p1);
insert into reports (reporter_id, reported_user_id, reason) values (auth.uid(), :c2, 'unangemessen');
select test.login(:admin);
select test.eq((select count(*) from admin_suspended_users() where id = :c2), 1::bigint, 'Nach 3 Meldungen automatisch gesperrt');
select admin_set_suspended(:c2, false);
select test.eq((select count(*) from reports where reported_user_id = :c2 and status = 'open'), 0::bigint, 'Entsperren schließt Meldungen');
select test.login(:s1);
insert into reports (reporter_id, reported_user_id, job_id, reason) values (auth.uid(), :c1, :'job1', 'sonstiges');
select test.login(:admin);
select test.eq((select count(*) from admin_report_chat((select id from reports where reported_user_id = :c1))), 1::bigint, 'Admin kann Chat zur Meldung lesen');

-- ================================================================ Chat endgültig löschen
reset role; select test.login(null);
update jobs set updated_at = now() - interval '8 days' where id = :'job1';
select test.eq(purge_finished_chats(), 0, 'Bei offener Meldung wird der Chat nicht gelöscht');
update reports set status = 'resolved' where reported_user_id = :c1;
select test.eq(purge_finished_chats(), 1, 'Nach 7 Tagen endgültig gelöscht');
set role authenticated;

-- ================================================================ Blockieren
select test.login(:s1);
insert into blocks (blocker_id, blocked_id) values (auth.uid(), :c1);
select test.login(:c1);
select test.eq((select count(*) from public_profiles where id = :s1), 0::bigint, 'Blockierter sieht Schüler nicht mehr');
select test.eq((select count(*) from client_suggestions()), 0::bigint, 'Blockierter bekommt Schüler nicht vorgeschlagen');

-- ================================================================ Rechte
select test.login(:s1);
select test.throws($$select purge_finished_chats()$$, 'permission denied');
select test.throws(format($$select suspend_user(%L, 'x')$$, :c1), 'permission denied');

-- ================================================================ Widerruf + Konto löschen
select test.login(:p1);
select set_parent_consent(:s1, false);
select test.login(:c2);
select test.eq((select count(*) from public_profiles where role = 'student'), 0::bigint, 'Nach Widerruf unsichtbar');
select test.login(:s1);
select delete_my_account();
reset role;
select test.eq((select count(*) from auth.users where id = :s1), 0::bigint, 'Konto gelöscht');

\echo 'ALLE TESTS BESTANDEN'
