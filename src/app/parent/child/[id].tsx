import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import ChildJobCard from '@/components/ChildJobCard';
import { CONSENT_BADGE } from '@/components/start/ParentStart';
import { Badge, Banner, Button, Card, Empty, H2, Loading, P, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { SERVICE_ICON, ageOn, formatPriceRange, fromIsoDate, serviceKey, workRuleFor, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { ChildJob, Offer, Profile } from '@/lib/types';

export default function ChildDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useProfile();
  const { t, lang } = useI18n();
  const [child, setChild] = useState<Profile | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [jobs, setJobs] = useState<ChildJob[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: c }, { data: o }, { data: j }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('offers').select('*').eq('student_id', id),
      supabase.rpc('child_jobs', { child: id }),
    ]);
    setChild(c as Profile | null);
    setOffers((o ?? []) as Offer[]);
    setJobs((j ?? []) as ChildJob[]);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function consent(approved: boolean) {
    const ok = approved
      ? await confirm(t('consent_give'), t('consent_give_q'), t('consent_give'))
      : await confirm(t('consent_revoke'), t('consent_revoke_q'), t('consent_revoke'), true);
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc('set_parent_consent', { child: id, approved });
    setBusy(false);
    if (error) return notify(t('error'), errorMessage(t, error));
    load();
  }

  if (child === undefined) return <Loading />;
  if (child === null) return <Screen><Empty title={t('not_found')} /></Screen>;

  const age = ageOn(fromIsoDate(child.birth_date));
  const rule = workRuleFor(age, child.full_time_school);
  const badge = CONSENT_BADGE[child.parent_consent];

  return (
    <Screen>
      <Card>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>{child.first_name} {child.last_name}, {age}</Text>
        <P muted>{child.postal_code} {child.city}</P>
        <P>{t('shown_as', { name: `${child.first_name} ${child.last_name[0]}., ${age}` })}</P>
        <Badge label={t(badge.key)} color={badge.color} />
        {rule && <P muted>🛡️ {t('allowed_times', { min: rule.minHour, max: rule.maxHour, h: rule.maxMinutesPerDay / 60 })}</P>}
      </Card>

      {me.verification_status !== 'verified' && child.parent_consent !== 'approved' && (
        <Banner tone="warning">
          <P>{t('ERR_PARENT_VERIFY_FIRST')}</P>
          <Button title={t('verify_now')} onPress={() => router.push('/verify')} />
        </Banner>
      )}

      {child.parent_consent === 'approved' ? (
        <Button title={t('consent_revoke')} variant="danger" onPress={() => consent(false)} loading={busy} />
      ) : child.parent_consent !== 'not_required' ? (
        <Button title={t('consent_give')} onPress={() => consent(true)} loading={busy} disabled={me.verification_status !== 'verified'} />
      ) : null}

      <H2>{t('child_jobs')}</H2>
      {jobs.length === 0 ? <P muted>{t('no_jobs')}</P> : jobs.map((j) => <ChildJobCard key={j.job_id} job={j} onChanged={load} />)}

      <H2>{t('offers')}</H2>
      {offers.length === 0 ? <P muted>—</P> : offers.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '700' }}>{SERVICE_ICON[o.service as Service]} {t(serviceKey(o.service))} – {o.title}</Text>
          <P muted>{formatPriceRange(o.price_min, o.price_max, lang)} {o.price_unit === 'stunde' ? t('per_hour') : t('per_job')}</P>
        </Card>
      ))}
    </Screen>
  );
}
