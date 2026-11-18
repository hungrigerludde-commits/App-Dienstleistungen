import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Badge, Button, Card, Empty, H2, P, Row, Screen, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { SERVICE_ICON, formatDateTime, formatPriceRange, type Service } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { JobPost } from '@/lib/types';

/** Meine Gesuche (Auftraggeber) */
export default function Posts() {
  const me = useProfile();
  const { t, lang } = useI18n();
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.from('job_posts').select('*').eq('client_id', me.id).order('scheduled_start');
    setPosts((data ?? []) as JobPost[]);
    const { data: jobs } = await supabase.from('jobs').select('post_id').eq('client_id', me.id).eq('status', 'requested');
    const c: Record<string, number> = {};
    for (const j of jobs ?? []) c[j.post_id] = (c[j.post_id] ?? 0) + 1;
    setCounts(c);
  }, [me.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const render = (p: JobPost) => (
    <Card key={p.id} onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', flex: 1 }}>{SERVICE_ICON[p.service as Service]} {p.title}</Text>
        {counts[p.id] ? <Badge label={counts[p.id] === 1 ? t('requests_1') : t('requests_n', { n: counts[p.id] })} color={colors.primary} /> : null}
      </Row>
      <P muted>📅 {formatDateTime(p.scheduled_start, lang)} · {formatPriceRange(p.price_min, p.price_max, lang)} {p.price_unit === 'stunde' ? t('per_hour') : t('per_job')}</P>
    </Card>
  );

  const open = posts.filter((p) => p.status === 'open');
  const closed = posts.filter((p) => p.status === 'closed');
  return (
    <Screen>
      <Button title={t('new_post')} onPress={() => router.push('/post/new')} />
      {posts.length === 0 && <Empty title={t('no_posts')} />}
      {open.length > 0 && <H2>{t('open_posts')}</H2>}
      {open.map(render)}
      {closed.length > 0 && <H2>{t('closed_posts')}</H2>}
      {closed.map(render)}
    </Screen>
  );
}
