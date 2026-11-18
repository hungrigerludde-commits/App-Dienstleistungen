import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import ChildJobCard from '@/components/ChildJobCard';
import StatusBanners from '@/components/StatusBanners';
import { Badge, Banner, Button, Card, Empty, H2, P, Screen, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { ageOn, fromIsoDate } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { ChildJob, Profile } from '@/lib/types';

export const CONSENT_BADGE = {
  pending: { key: 'consent_pending', color: '#B26A00' },
  approved: { key: 'consent_approved', color: colors.success },
  rejected: { key: 'consent_rejected', color: colors.danger },
  not_required: { key: 'consent_approved', color: colors.muted },
} as const;

export default function ParentStart() {
  const me = useProfile();
  const { t } = useI18n();
  const [children, setChildren] = useState<Profile[] | null>(null);
  const [jobs, setJobs] = useState<(ChildJob & { child: string })[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('parent_id', me.id).order('first_name');
    const kids = (data ?? []) as Profile[];
    setChildren(kids);
    const all: (ChildJob & { child: string })[] = [];
    for (const k of kids) {
      const { data: cj } = await supabase.rpc('child_jobs', { child: k.id });
      for (const j of (cj ?? []) as ChildJob[]) {
        if (j.status === 'requested' || j.status === 'accepted') all.push({ ...j, child: k.first_name });
      }
    }
    all.sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
    setJobs(all);
  }, [me.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <StatusBanners needsLocation={false} />
      <Banner>{t('parent_intro')}</Banner>

      {jobs.length > 0 && <H2>{t('upcoming')}</H2>}
      {jobs.map((j) => <ChildJobCard key={j.job_id} job={j} childName={j.child} onChanged={load} />)}

      <H2>{t('my_children')}</H2>
      {children && children.length === 0 && <Empty title={t('no_children')} text={t('link_child_hint')} />}
      {children?.map((c) => (
        <Card key={c.id} onPress={() => router.push({ pathname: '/parent/child/[id]', params: { id: c.id } })}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{c.first_name} {c.last_name}, {ageOn(fromIsoDate(c.birth_date))}</Text>
          <Badge label={t(CONSENT_BADGE[c.parent_consent].key)} color={CONSENT_BADGE[c.parent_consent].color} />
        </Card>
      ))}
      <Button title={t('link_child')} variant="secondary" onPress={() => router.push('/parent/link')} />
      <P muted>{t('link_child_hint')}</P>
    </Screen>
  );
}
