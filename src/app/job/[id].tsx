import { goBack } from '@/lib/nav';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Banner, Button, Card, Chip, ChipRow, Empty, ErrorText, Field, H2, Loading, P, Row, Screen, Stars, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { JOB_STATUS_COLOR, PAYMENT_METHODS, SERVICE_ICON, formatDateTime, formatMoney, serviceKey, type Service } from '@/lib/rules';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import type { Job, Payment, PostAddress, PublicProfile, Review } from '@/lib/types';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useProfile();
  const { t, lang } = useI18n();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [address, setAddress] = useState<PostAddress | null>(null);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const [payment, setPayment] = useState<Payment | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('paypal');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: j } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
    setJob(j as Job | null);
    if (!j) return;
    const [{ data: a }, { data: ps }, { data: pay }, { data: r }] = await Promise.all([
      supabase.from('post_addresses').select('*').eq('post_id', j.post_id).maybeSingle(),
      supabase.from('public_profiles').select('*').in('id', [j.client_id, j.student_id]),
      supabase.from('payments').select('*').eq('job_id', id).maybeSingle(),
      supabase.from('reviews').select('*').eq('job_id', id),
    ]);
    setAddress(a as PostAddress | null);
    setPeople(Object.fromEntries(((ps ?? []) as PublicProfile[]).map((p) => [p.id, p])));
    setPayment(pay as Payment | null);
    setReviews((r ?? []) as Review[]);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function rpc(fn: string, args: Record<string, unknown>, question?: string, danger = false) {
    if (question && !(await confirm(question, '', t('yes'), danger))) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) setError(errorMessage(t, error));
    load();
  }

  async function submitReview() {
    if (!rating) return setError(t('err_rating'));
    setBusy(true);
    const { error } = await supabase.from('reviews').insert({ job_id: id, reviewer_id: me.id, reviewee_id: me.id, rating, comment: comment.trim() || null });
    setBusy(false);
    if (error) return setError(errorMessage(t, error));
    notify(t('rate_thanks'));
    load();
  }

  async function block(otherId: string) {
    if (!(await confirm(t('block_user'), t('block_q'), t('block_user'), true))) return;
    await supabase.from('blocks').insert({ blocker_id: me.id, blocked_id: otherId });
    goBack();
  }

  if (job === undefined) return <Loading />;
  if (job === null) return <Screen><Empty title={t('not_found')} /></Screen>;

  const isClient = me.id === job.client_id;
  const isStudent = me.id === job.student_id;
  const isParent = me.role === 'parent';
  const otherId = isClient ? job.student_id : job.client_id;
  const other = people[otherId];
  const myTurn = job.status === 'requested' && ((job.initiated_by === 'student' && isClient) || (job.initiated_by === 'client' && isStudent));
  const open = job.status === 'requested' || job.status === 'accepted';
  const myDone = isClient ? job.client_done : job.student_done;
  const otherDone = isClient ? job.student_done : job.client_done;
  const myReview = reviews.find((r) => r.reviewer_id === me.id);

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.muted, fontWeight: '700', flex: 1 }}>{SERVICE_ICON[job.service as Service]} {t(serviceKey(job.service))}</Text>
          <Badge label={t(`job_${job.status}` as StringKey)} color={JOB_STATUS_COLOR[job.status]} />
        </Row>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>{job.title}</Text>
        <P>{job.description}</P>
        <P>📅 {formatDateTime(job.scheduled_start, lang)} · {job.duration_minutes} {t('minutes')}</P>
        <P>💶 {t('agreed_price')}: <Text style={{ fontWeight: '800' }}>{formatMoney(job.agreed_price, lang)} €</Text></P>
      </Card>

      <Card>
        <H2>{t('address')}</H2>
        {address ? <P>{address.street}, {address.postal_code} {address.city}{address.notes ? `\n${address.notes}` : ''}</P> : <P muted>{t('address_locked')}</P>}
      </Card>

      <Card>
        <H2>{isParent ? `${t('client')} / ${t('student')}` : isClient ? t('student') : t('client')}</H2>
        {isParent ? (
          <>
            <P>{t('client')}: {people[job.client_id]?.display_name ?? '–'} {people[job.client_id]?.is_verified ? `(${t('verified')} ✓)` : ''}</P>
            <P>{t('student')}: {people[job.student_id]?.display_name ?? '–'}</P>
          </>
        ) : other ? (
          <>
            <Text
              style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}
              onPress={() => other.role === 'student' && router.push({ pathname: '/student/[id]', params: { id: other.id } })}
            >
              {other.display_name}{other.role === 'student' ? `, ${other.age}` : ''} {other.is_verified ? `· ${t('verified')} ✓` : ''}
            </Text>
            <Row><Stars value={other.avg_rating ?? 0} /><P muted>{other.review_count === 1 ? t('review_1') : t('reviews_n', { n: other.review_count })}</P></Row>
          </>
        ) : <P muted>–</P>}
      </Card>

      {open && <Button title={t('open_chat')} variant="secondary" onPress={() => router.push({ pathname: '/chat/[jobId]', params: { jobId: job.id } })} />}
      {job.status === 'completed' && <Banner>{t('chat_deleted')}</Banner>}

      <ErrorText>{error}</ErrorText>

      {/* Antwort auf Anfrage/Bewerbung */}
      {myTurn && (
        <>
          {isStudent && <Banner>{t('tell_parents_tip')}</Banner>}
          <Button title={t('accept')} onPress={() => rpc('respond_to_job', { job: job.id, accept: true })} loading={busy} />
          <Button title={t('decline')} variant="secondary" onPress={() => rpc('respond_to_job', { job: job.id, accept: false }, t('decline_q'))} />
        </>
      )}
      {job.status === 'requested' && !myTurn && !isParent && <P muted>{t('waiting_other')}</P>}

      {/* Bezahlung */}
      {(job.status === 'accepted' || payment) && (
        <Card>
          <H2>{t('payment')}</H2>
          {payment ? (
            <P>
              {payment.status === 'held' ? t('pay_held') : payment.status === 'released' ? t('pay_released') : t('pay_refunded')}
              {' '}({t(`pay_${payment.method}` as StringKey)}, {formatMoney(payment.amount, lang)} €)
            </P>
          ) : isClient ? (
            <>
              <P style={{ fontWeight: '600' }}>{t('pay_method')}</P>
              <ChipRow>
                {PAYMENT_METHODS.map((m) => <Chip key={m} label={t(`pay_${m}` as StringKey)} selected={method === m} onPress={() => setMethod(m)} />)}
              </ChipRow>
              <Banner tone="warning">{t('pay_test_hint')}</Banner>
              <Button title={t('pay_confirm', { amount: formatMoney(job.agreed_price, lang) })} onPress={() => rpc('demo_pay', { job: job.id, method })} loading={busy} />
            </>
          ) : <P muted>{t('pay_waiting')}</P>}
        </Card>
      )}

      {/* Beidseitig „Fertig“ */}
      {job.status === 'accepted' && (isClient || isStudent) && (
        <Card>
          <P muted>{t('done_both_hint')}</P>
          {myDone ? <P>✅ {t('done_you')}</P> : (
            <Button title={t('mark_done')} onPress={() => (isClient && !payment ? setError(t('pay_required')) : rpc('confirm_job_done', { job: job.id }, t('mark_done_q')))} loading={busy} />
          )}
          {otherDone && <P>✅ {t('done_other')}</P>}
        </Card>
      )}

      {open && (isClient || isStudent || isParent) && (
        <Button title={t('cancel_job')} variant="danger" onPress={() => rpc('cancel_job', { job: job.id }, t('cancel_job_q'), true)} />
      )}

      {/* Bewertung */}
      {job.status === 'completed' && (isClient || isStudent) && (myReview ? (
        <Banner tone="success">{t('rated', { n: myReview.rating })}</Banner>
      ) : (
        <Card>
          <H2>{t('rate')}</H2>
          <Stars value={rating} size={36} onChange={setRating} />
          <Field label={`${t('rate_comment')} ${t('optional')}`} value={comment} onChangeText={setComment} multiline maxLength={500} />
          <Button title={t('rate_send')} onPress={submitReview} loading={busy} />
        </Card>
      ))}

      {!isParent && other && (
        <Row style={{ justifyContent: 'center' }}>
          <Button title={t('report_problem')} variant="ghost" onPress={() => router.push({ pathname: '/report', params: { userId: otherId, jobId: job.id } })} />
          <Button title={t('block_user')} variant="ghost" onPress={() => block(otherId)} />
        </Row>
      )}
      <View style={{ height: 20 }} />
    </Screen>
  );
}
