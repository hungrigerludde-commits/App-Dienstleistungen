import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import JobCard from '@/components/JobCard';
import { Badge, Banner, Button, Card, Empty, H2, Loading, P, Screen, colors } from '@/components/ui';
import { confirm, notify } from '@/lib/dialog';
import { ageOn, categoryLabel, formatPrice, fromIsoDate, workRuleFor } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';
import type { Job, Offer, Profile } from '@/lib/types';

export default function ChildDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [child, setChild] = useState<Profile | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: c }, { data: o }, { data: j }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('offers').select('*').eq('student_id', id),
      supabase.from('jobs').select('*').eq('student_id', id).order('scheduled_start', { ascending: false }),
    ]);
    setChild(c as Profile | null);
    setOffers((o ?? []) as Offer[]);
    setJobs((j ?? []) as Job[]);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function consent(approved: boolean) {
    const ok = approved
      ? await confirm('Zustimmung erteilen?',
          'Ich bin erziehungsberechtigt und erlaube meinem Kind, über StadtHelfer kleine Aufträge anzunehmen. ' +
          'Ich willige in die Verarbeitung seiner Daten gemäß Datenschutzerklärung ein. Ich kann die Zustimmung jederzeit widerrufen.',
          'Zustimmen')
      : await confirm('Zustimmung widerrufen?', 'Das Profil wird sofort unsichtbar und offene Anfragen werden abgelehnt.', 'Widerrufen', true);
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc('set_parent_consent', { child: id, approved });
    setBusy(false);
    if (error) return notify('Fehler', errorText(error));
    load();
  }

  if (child === undefined) return <Loading />;
  if (child === null) return <Screen><Empty title="Kein Zugriff" /></Screen>;

  const age = ageOn(fromIsoDate(child.birth_date));
  const rule = workRuleFor(age, child.full_time_school);

  return (
    <Screen>
      <Card>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>{child.first_name} {child.last_name}, {age}</Text>
        <P muted>{child.postal_code} {child.city}</P>
        <P>Öffentlich angezeigt als: <Text style={{ fontWeight: '700' }}>{child.first_name} {child.last_name[0]}., {age}</Text></P>
        {child.parent_consent === 'approved' && <Badge label="Freigegeben" color={colors.success} />}
        {child.parent_consent === 'pending' && <Badge label="Wartet auf deine Zustimmung" color="#B26A00" />}
        {child.parent_consent === 'rejected' && <Badge label="Nicht freigegeben" color={colors.danger} />}
        {rule && <P muted>🛡️ Erlaubte Zeiten: {rule.minHour}–{rule.maxHour} Uhr, max. {rule.maxMinutesPerDay / 60} Std./Tag</P>}
      </Card>

      {child.parent_consent === 'approved' ? (
        <Button title="Zustimmung widerrufen" variant="danger" onPress={() => consent(false)} loading={busy} />
      ) : child.parent_consent !== 'not_required' ? (
        <>
          <Banner>
            Bitte prüfe das Profil und die Angebote deines Kindes. Mit deiner Zustimmung wird das Profil für verifizierte Auftraggeber sichtbar.
          </Banner>
          <Button title="Zustimmen und freigeben" onPress={() => consent(true)} loading={busy} />
        </>
      ) : null}

      <H2>Angebote</H2>
      {offers.length === 0 ? <P muted>Noch keine Angebote.</P> : offers.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '700' }}>{categoryLabel(o.category)} – {o.title}</Text>
          <P muted>{formatPrice(o.price_min, o.price_max, o.price_unit)}</P>
        </Card>
      ))}

      <H2>Aufträge</H2>
      {jobs.length === 0 ? <P muted>Noch keine Aufträge.</P> : jobs.map((j) => <JobCard key={j.id} job={j} />)}
    </Screen>
  );
}
