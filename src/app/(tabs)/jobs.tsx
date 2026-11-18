import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import JobCard from '@/components/JobCard';
import { Chip, ChipRow, Empty, Loading, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/lib/types';

const FILTERS = [
  { key: 'open', label: 'Offen', statuses: ['requested', 'accepted'] },
  { key: 'done', label: 'Erledigt', statuses: ['completed'] },
  { key: 'closed', label: 'Abgesagt', statuses: ['declined', 'cancelled'] },
];

export default function Jobs() {
  const me = useProfile();
  const [filter, setFilter] = useState('open');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const statuses = FILTERS.find((f) => f.key === filter)!.statuses;
    // RLS liefert automatisch nur Aufträge, an denen ich (oder mein Kind) beteiligt bin.
    const { data } = await supabase
      .from('jobs').select('*').in('status', statuses)
      .order('scheduled_start', { ascending: filter === 'open' });
    const list = (data ?? []) as Job[];
    setJobs(list);

    const otherIds = [...new Set(list.map((j) => (j.client_id === me.id ? j.student_id : j.client_id)))];
    if (otherIds.length) {
      const { data: ps } = await supabase.from('public_profiles').select('id, display_name').in('id', otherIds);
      setNames(Object.fromEntries((ps ?? []).map((p) => [p.id, p.display_name])));
    }
  }, [filter, me.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live-Aktualisierung, wenn sich ein Auftrag ändert
  useFocusEffect(useCallback(() => {
    const ch = supabase.channel('jobs-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]));

  const emptyText = {
    student: 'Hier erscheinen Anfragen von Auftraggebern.',
    client: 'Suche einen Schüler und sende eine Anfrage.',
    parent: 'Hier siehst du die Aufträge deines Kindes.',
  }[me.role];

  return (
    <Screen>
      <ChipRow>
        {FILTERS.map((f) => <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />)}
      </ChipRow>
      {jobs === null ? <Loading /> : jobs.length === 0 ? (
        <Empty title="Keine Aufträge" text={emptyText} />
      ) : jobs.map((j) => (
        <JobCard key={j.id} job={j} otherName={names[j.client_id === me.id ? j.student_id : j.client_id]} />
      ))}
    </Screen>
  );
}
