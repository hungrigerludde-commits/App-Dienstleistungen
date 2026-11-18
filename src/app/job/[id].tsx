import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import {
  Badge, Banner, Button, Card, Empty, ErrorText, Field, H2, Loading, P, Row, Screen, Stars, colors,
} from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { JOB_STATUS, PAYMENT_METHODS, categoryLabel, formatDateTime } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';
import type { Job, JobAddress, JobStatus, PublicProfile, Review } from '@/lib/types';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useProfile();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [address, setAddress] = useState<JobAddress | null>(null);
  const [client, setClient] = useState<PublicProfile | null>(null);
  const [student, setStudent] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: j } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
    setJob(j as Job | null);
    if (!j) return;
    const [{ data: a }, { data: ps }, { data: r }] = await Promise.all([
      supabase.from('job_addresses').select('*').eq('job_id', id).maybeSingle(),
      supabase.from('public_profiles').select('*').in('id', [j.client_id, j.student_id]),
      supabase.from('reviews').select('*').eq('job_id', id),
    ]);
    setAddress(a as JobAddress | null);
    setClient(((ps ?? []) as PublicProfile[]).find((p) => p.id === j.client_id) ?? null);
    setStudent(((ps ?? []) as PublicProfile[]).find((p) => p.id === j.student_id) ?? null);
    setReviews((r ?? []) as Review[]);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setStatus(status: JobStatus, question?: string) {
    if (question && !(await confirm('Bist du sicher?', question, 'Ja'))) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.from('jobs').update({ status }).eq('id', id);
    setBusy(false);
    if (error) return setError(errorText(error));
    load();
  }

  async function submitReview() {
    if (!rating) return setError('Bitte wähle 1–5 Sterne.');
    setBusy(true);
    const { error } = await supabase.from('reviews').insert({
      job_id: id, reviewer_id: me.id, reviewee_id: me.id, // reviewee wird von der Datenbank gesetzt
      rating, comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) return setError(errorText(error));
    notify('Danke für deine Bewertung!');
    load();
  }

  if (job === undefined) return <Loading />;
  if (job === null) return <Screen><Empty title="Auftrag nicht gefunden" /></Screen>;

  const isClient = me.id === job.client_id;
  const isStudent = me.id === job.student_id;
  const isParent = me.role === 'parent';
  const other = isClient ? student : client;
  const st = JOB_STATUS[job.status];
  const myReview = reviews.find((r) => r.reviewer_id === me.id);
  const open = job.status === 'requested' || job.status === 'accepted';

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '800', fontSize: 18, flex: 1 }}>{categoryLabel(job.category)}</Text>
          <Badge label={st.label} color={st.color} />
        </Row>
        <P>{job.description}</P>
        <P>📅 {formatDateTime(job.scheduled_start)}</P>
        <P>⏱ {job.duration_minutes} Minuten</P>
        <P>💶 {job.agreed_price != null ? `${job.agreed_price} €` : 'Preis nach Absprache'} · {PAYMENT_METHODS.find((p) => p.key === job.payment_method)?.label}</P>
      </Card>

      <Card>
        <H2>{isClient ? 'Schüler' : isParent ? 'Beteiligte' : 'Auftraggeber'}</H2>
        {isParent ? (
          <>
            <P>Auftraggeber: {client?.display_name ?? '–'} {client?.is_verified ? '✓ verifiziert' : ''}</P>
            <P>Schüler: {student?.display_name ?? '–'}</P>
          </>
        ) : other ? (
          <Text
            style={{ color: colors.primary, fontWeight: '600' }}
            onPress={() => other.role === 'student' && router.push({ pathname: '/student/[id]', params: { id: other.id } })}
          >
            {other.display_name} {other.is_verified ? '✓ verifiziert' : ''}
          </Text>
        ) : <P muted>Profil nicht mehr verfügbar</P>}
        {other?.review_count ? <Row><Stars value={other.avg_rating ?? 0} /><P muted>({other.review_count})</P></Row> : null}
      </Card>

      <Card>
        <H2>Adresse</H2>
        {address ? (
          <>
            <P>{address.street}</P>
            <P>{address.postal_code} {address.city}</P>
            {address.notes ? <P muted>{address.notes}</P> : null}
          </>
        ) : (
          <P muted>🔒 Die genaue Adresse wird sichtbar, sobald der Auftrag zugesagt wurde.</P>
        )}
      </Card>

      {job.status !== 'declined' && job.status !== 'cancelled' && (
        <Button title="💬 Chat öffnen" variant="secondary" onPress={() => router.push({ pathname: '/chat/[jobId]', params: { jobId: job.id } })} />
      )}

      <ErrorText>{error}</ErrorText>

      {isStudent && job.status === 'requested' && (
        <>
          <Banner>Tipp: Sag deinen Eltern Bescheid, wann und wo du arbeitest.</Banner>
          <Button title="Zusagen" onPress={() => setStatus('accepted')} loading={busy} />
          <Button title="Ablehnen" variant="secondary" onPress={() => setStatus('declined', 'Möchtest du diese Anfrage ablehnen?')} />
        </>
      )}
      {isClient && job.status === 'accepted' && (
        <Button title="Als erledigt markieren" onPress={() => setStatus('completed', 'Wurde der Auftrag erledigt und bezahlt?')} loading={busy} />
      )}
      {open && (isClient || isStudent || isParent) && (
        <Button title="Auftrag absagen" variant="danger" onPress={() => setStatus('cancelled', 'Möchtest du diesen Auftrag absagen?')} />
      )}

      {job.status === 'completed' && (isClient || isStudent) && (
        myReview ? (
          <Banner tone="success">Du hast diesen Auftrag mit {myReview.rating} Sternen bewertet.</Banner>
        ) : (
          <Card>
            <H2>Bewertung abgeben</H2>
            <Stars value={rating} size={34} onChange={setRating} />
            <Field label="Kommentar (optional)" value={comment} onChangeText={setComment} multiline />
            <Button title="Bewertung senden" onPress={submitReview} loading={busy} />
          </Card>
        )
      )}

      {!isParent && other && (
        <Button title="Problem melden" variant="ghost"
          onPress={() => router.push({ pathname: '/report', params: { userId: other.id, jobId: job.id } })} />
      )}
    </Screen>
  );
}
