import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import PhotoGrid from '@/components/PhotoGrid';
import PriceLight from '@/components/PriceLight';
import { Badge, Banner, Button, Card, Empty, H2, Loading, P, Row, Screen, Stars, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { JOB_STATUS_COLOR, SERVICE_ICON, distanceKm, formatDateTime, formatMoney, formatPriceRange, serviceKey, type Service } from '@/lib/rules';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import type { Job, JobPost, PostAddress, PublicProfile } from '@/lib/types';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useProfile();
  const { t, lang } = useI18n();
  const [post, setPost] = useState<JobPost | null | undefined>(undefined);
  const [address, setAddress] = useState<PostAddress | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [client, setClient] = useState<PublicProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('job_posts').select('*').eq('id', id).maybeSingle();
    setPost(p as JobPost | null);
    if (!p) return;
    const [{ data: a }, { data: ph }, { data: c }, { data: j }] = await Promise.all([
      supabase.from('post_addresses').select('*').eq('post_id', id).maybeSingle(),
      supabase.from('photos').select('storage_path').eq('post_id', id),
      supabase.from('public_profiles').select('*').eq('id', p.client_id).maybeSingle(),
      supabase.from('jobs').select('*').eq('post_id', id).order('created_at'),
    ]);
    setAddress(a as PostAddress | null);
    setPhotos((ph ?? []).map((x) => x.storage_path));
    setClient(c as PublicProfile | null);
    const js = (j ?? []) as Job[];
    setJobs(js);
    if (js.length) {
      const { data: ps } = await supabase.from('public_profiles').select('id, display_name').in('id', js.map((x) => x.student_id));
      setNames(Object.fromEntries((ps ?? []).map((x) => [x.id, x.display_name as string])));
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function apply() {
    setBusy(true);
    const { data, error } = await supabase.rpc('apply_to_post', { post: id });
    setBusy(false);
    if (error) return notify(t('error'), errorMessage(t, error));
    router.replace({ pathname: '/job/[id]', params: { id: data as string } });
  }

  async function respond(jobId: string, accept: boolean) {
    const { error } = await supabase.rpc('respond_to_job', { job: jobId, accept });
    if (error) notify(t('error'), errorMessage(t, error));
    load();
  }

  async function setStatus(status: 'open' | 'closed') {
    if (status === 'closed' && !(await confirm(t('close_post'), t('close_post_q'), t('yes')))) return;
    await supabase.from('job_posts').update({ status }).eq('id', id);
    load();
  }

  if (post === undefined) return <Loading />;
  if (post === null) return <Screen><Empty title={t('not_found')} /></Screen>;

  const mine = post.client_id === me.id;
  const myJob = jobs.find((j) => j.student_id === me.id);
  const dist = me.home_lat != null ? Math.max(1, Math.round(distanceKm(me.home_lat, me.home_lng!, post.approx_lat, post.approx_lng))) : null;

  return (
    <Screen>
      {photos.length > 0 && <PhotoGrid paths={photos} size={150} />}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.muted, fontWeight: '700' }}>{SERVICE_ICON[post.service as Service]} {t(serviceKey(post.service))}</Text>
          <Badge label={t(post.status === 'open' ? 'status_open' : 'status_closed')} color={post.status === 'open' ? colors.success : colors.muted} />
        </Row>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>{post.title}</Text>
        <P>{post.description}</P>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primaryDark }}>
          {formatPriceRange(post.price_min, post.price_max, lang)} {post.price_unit === 'stunde' ? t('per_hour') : t('per_job')}
        </Text>
        <PriceLight service={post.service} min={post.price_min} max={post.price_max} unit={post.price_unit} durationMinutes={post.duration_minutes} showReference />
        <P>📅 {formatDateTime(post.scheduled_start, lang)} · {post.duration_minutes} {t('minutes')}</P>
        <P>📍 {address ? `${address.street}, ${address.postal_code} ${address.city}` : `${t('in_area', { city: post.city })}${dist ? ` · ${t('away_km', { n: dist })}` : ''}`}</P>
        {address?.notes ? <P muted>{address.notes}</P> : null}
      </Card>

      {client && !mine && (
        <Card>
          <Text style={{ fontWeight: '700' }}>{client.display_name} {client.is_verified ? `· ${t('verified')} ✓` : ''}</Text>
          <Row><Stars value={client.avg_rating ?? 0} /><P muted>{client.review_count === 1 ? t('review_1') : t('reviews_n', { n: client.review_count })}</P></Row>
        </Card>
      )}

      {me.role === 'student' && !myJob && post.status === 'open' && (
        <Button title={t('apply')} onPress={apply} loading={busy} />
      )}
      {myJob && <Button title={t('already_applied')} variant="secondary" onPress={() => router.push({ pathname: '/job/[id]', params: { id: myJob.id } })} />}

      {mine && (
        <>
          <H2>{t('requests')}</H2>
          {jobs.length === 0 && <P muted>—</P>}
          {jobs.map((j) => (
            <Card key={j.id} onPress={() => router.push({ pathname: '/job/[id]', params: { id: j.id } })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '700' }}>{names[j.student_id] ?? '…'}</Text>
                <Badge label={t(`job_${j.status}` as StringKey)} color={JOB_STATUS_COLOR[j.status]} />
              </Row>
              <P muted>{formatMoney(j.agreed_price, lang)} €</P>
              {j.status === 'requested' && j.initiated_by === 'student' && (
                <Row>
                  <View style={{ flex: 1 }}><Button title={t('accept')} onPress={() => respond(j.id, true)} /></View>
                  <View style={{ flex: 1 }}><Button title={t('decline')} variant="secondary" onPress={() => respond(j.id, false)} /></View>
                </Row>
              )}
            </Card>
          ))}
          {post.status === 'open' ? (
            <>
              <Button title={t('suitable_students')} variant="secondary" onPress={() => router.navigate('/')} />
              <Button title={t('close_post')} variant="ghost" onPress={() => setStatus('closed')} />
            </>
          ) : (
            <Button title={t('reopen_post')} variant="ghost" onPress={() => setStatus('open')} />
          )}
        </>
      )}

      {!mine && (
        <Button title={t('report_problem')} variant="ghost" onPress={() => router.push({ pathname: '/report', params: { userId: post.client_id } })} />
      )}
      {!mine && me.role === 'student' && post.status === 'open' && <Banner>{t('tell_parents_tip')}</Banner>}
    </Screen>
  );
}
