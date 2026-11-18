import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import AdBanner from '@/components/AdBanner';
import { Avatar, Badge, Card, Empty, Loading, P, Row, Screen, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { JOB_STATUS_COLOR, SERVICE_ICON, type Service } from '@/lib/rules';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import type { Job, Message } from '@/lib/types';

type ChatRow = { job: Job; other: string; last?: Message };

/** Alle laufenden Chats (Chats abgeschlossener Aufträge werden gelöscht). */
export default function Chats() {
  const me = useProfile();
  const { t } = useI18n();
  const [rows, setRows] = useState<ChatRow[] | null>(null);

  const load = useCallback(async () => {
    const { data: jobs } = await supabase.from('jobs').select('*').in('status', ['requested', 'accepted']).order('updated_at', { ascending: false });
    const list = (jobs ?? []) as Job[];
    if (!list.length) return setRows([]);
    const ids = list.map((j) => j.id);
    const people = [...new Set(list.flatMap((j) => [j.client_id, j.student_id]))];
    const [{ data: msgs }, { data: ps }] = await Promise.all([
      supabase.from('messages').select('*').in('job_id', ids).order('created_at', { ascending: false }),
      supabase.from('public_profiles').select('id, display_name').in('id', people),
    ]);
    const names = Object.fromEntries((ps ?? []).map((p) => [p.id, p.display_name as string]));
    const last: Record<string, Message> = {};
    for (const m of (msgs ?? []) as Message[]) last[m.job_id] ??= m;
    setRows(list.map((j) => ({
      job: j,
      other: me.role === 'parent'
        ? `${names[j.student_id] ?? ''} ↔ ${names[j.client_id] ?? ''}`
        : names[j.client_id === me.id ? j.student_id : j.client_id] ?? '',
      last: last[j.id],
    })).sort((a, b) => (b.last?.created_at ?? b.job.created_at).localeCompare(a.last?.created_at ?? a.job.created_at)));
  }, [me.id, me.role]);

  useFocusEffect(useCallback(() => {
    load();
    const ch = supabase.channel('chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]));

  if (rows === null) return <Loading />;
  return (
    <Screen>
      {rows.length === 0 && <Empty title={t('no_chats')} text={t('no_chats_text')} />}
      {rows.map((r) => (
        <Card key={r.job.id} onPress={() => router.push({ pathname: '/chat/[jobId]', params: { jobId: r.job.id } })}>
          <Row>
            <Avatar name={r.other || '?'} />
            <View style={{ flex: 1, gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>{r.other}</Text>
                <Badge label={t(`job_${r.job.status}` as StringKey)} color={JOB_STATUS_COLOR[r.job.status]} />
              </Row>
              <Text style={{ color: colors.muted }} numberOfLines={1}>{SERVICE_ICON[r.job.service as Service]} {r.job.title}</Text>
              <P numberOfLines={1}>{r.last ? r.last.body : t('no_messages')}</P>
            </View>
          </Row>
        </Card>
      ))}
      <AdBanner seed={3} />
    </Screen>
  );
}
