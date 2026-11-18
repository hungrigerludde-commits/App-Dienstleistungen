import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import JobCard from '@/components/JobCard';
import { Chip, ChipRow, Empty, Loading, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/lib/types';

const FILTERS: { key: StringKey; statuses: string[] }[] = [
  { key: 'filter_open', statuses: ['requested', 'accepted'] },
  { key: 'filter_done', statuses: ['completed'] },
  { key: 'filter_closed', statuses: ['declined', 'cancelled'] },
];

export default function Jobs() {
  const me = useProfile();
  const { t } = useI18n();
  const [filter, setFilter] = useState(0);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.from('jobs').select('*').in('status', FILTERS[filter].statuses)
      .order('scheduled_start', { ascending: filter === 0 });
    const list = (data ?? []) as Job[];
    setJobs(list);
    const others = [...new Set(list.map((j) => (j.client_id === me.id ? j.student_id : j.client_id)))];
    if (others.length) {
      const { data: ps } = await supabase.from('public_profiles').select('id, display_name').in('id', others);
      setNames(Object.fromEntries((ps ?? []).map((p) => [p.id, p.display_name as string])));
    }
  }, [filter, me.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <ChipRow>
        {FILTERS.map((f, i) => <Chip key={f.key} label={t(f.key)} selected={filter === i} onPress={() => setFilter(i)} />)}
      </ChipRow>
      {jobs === null ? <Loading /> : jobs.length === 0 ? <Empty title={t('no_jobs')} /> : jobs.map((j) => (
        <JobCard key={j.id} job={j} otherName={names[j.client_id === me.id ? j.student_id : j.client_id]} />
      ))}
    </Screen>
  );
}
