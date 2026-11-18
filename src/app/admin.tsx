import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Banner, Button, Card, Empty, H2, P, Row, Screen, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { useSignedUrls } from '@/lib/photos';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';

type Verification = {
  id: string; user_id: string; doc_type: string; front_path: string | null; back_path: string | null; selfie_path: string | null; created_at: string;
};
type ReportRow = { id: string; reporter_id: string; reported_user_id: string; job_id: string | null; reason: string; details: string | null; created_at: string };
type Person = { id: string; first_name: string; last_name: string; role: string; birth_date: string; city: string };
type ChatLine = { job_title: string; sender_name: string; body: string; created_at: string };
type Suspended = { id: string; first_name: string; last_name: string; role: string; suspended_reason: string | null };

/** Moderation: Ausweise prüfen, Meldungen bearbeiten (inkl. Chat ansehen), Sperren. */
export default function Admin() {
  const me = useProfile();
  const { t } = useI18n();
  const [verifs, setVerifs] = useState<Verification[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [suspended, setSuspended] = useState<Suspended[]>([]);
  const [chat, setChat] = useState<{ report: string; lines: ChatLine[] } | null>(null);

  const load = useCallback(async () => {
    const [{ data: v }, { data: r }, { data: s }] = await Promise.all([
      supabase.from('verifications').select('*').eq('status', 'pending').order('created_at'),
      supabase.from('reports').select('*').eq('status', 'open').order('created_at'),
      supabase.rpc('admin_suspended_users'),
    ]);
    const vs = (v ?? []) as Verification[];
    const rs = (r ?? []) as ReportRow[];
    setVerifs(vs);
    setReports(rs);
    setSuspended((s ?? []) as Suspended[]);
    const ids = [...new Set([...vs.map((x) => x.user_id), ...rs.flatMap((x) => [x.reporter_id, x.reported_user_id])])];
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id, first_name, last_name, role, birth_date, city').in('id', ids);
      setPeople(Object.fromEntries(((ps ?? []) as Person[]).map((p) => [p.id, p])));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function review(v: Verification, approve: boolean) {
    const { error } = await supabase.rpc('admin_review_verification', { verification: v.id, approve });
    if (error) return notify(t('error'), errorMessage(t, error));
    // Ausweis-Bilder sofort löschen (Datensparsamkeit)
    const paths = [v.front_path, v.back_path, v.selfie_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('id-documents').remove(paths);
    load();
  }

  async function viewChat(reportId: string) {
    const { data, error } = await supabase.rpc('admin_report_chat', { report: reportId });
    if (error) return notify(t('error'), errorMessage(t, error));
    setChat({ report: reportId, lines: (data ?? []) as ChatLine[] });
  }

  async function suspend(userId: string, on: boolean) {
    if (on && !(await confirm(t('suspend'), '', t('suspend'), true))) return;
    const { error } = await supabase.rpc('admin_set_suspended', { target: userId, suspended: on });
    if (error) notify(t('error'), errorMessage(t, error));
    load();
  }

  async function resolve(id: string) {
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', id);
    load();
  }

  if (!me.is_admin) return <Screen><Empty title={t('ERR_NOT_ALLOWED')} /></Screen>;
  const name = (id: string) => (people[id] ? `${people[id].first_name} ${people[id].last_name} (${people[id].role})` : id.slice(0, 8));

  return (
    <Screen>
      <H2>{t('admin_verifications')} ({verifs.length})</H2>
      <Banner>{t('admin_hint')}</Banner>
      {verifs.length === 0 && <P muted>{t('none')}</P>}
      {verifs.map((v) => (
        <VerificationCard key={v.id} v={v} person={people[v.user_id]} onReview={(ok) => review(v, ok)} />
      ))}

      <H2>{t('admin_reports')} ({reports.length})</H2>
      {reports.length === 0 && <P muted>{t('none')}</P>}
      {reports.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: '700' }}>{t(`report_reason_${r.reason}` as StringKey)}</Text>
          <P>{t('reported_by')}: {name(r.reporter_id)}</P>
          <P>{t('reported_user')}: {name(r.reported_user_id)}</P>
          {r.details ? <P muted>„{r.details}“</P> : null}
          <Button title={t('view_chat')} variant="secondary" onPress={() => viewChat(r.id)} />
          {chat?.report === r.id && (
            <View style={{ backgroundColor: colors.bg, borderRadius: 10, padding: 10, gap: 4 }}>
              {chat.lines.length === 0 ? <P muted>{t('no_messages')}</P> : chat.lines.map((l, i) => (
                <P key={i}><Text style={{ fontWeight: '700' }}>{l.sender_name}:</Text> {l.body}</P>
              ))}
            </View>
          )}
          <Row>
            <View style={{ flex: 1 }}><Button title={t('suspend')} variant="danger" onPress={() => suspend(r.reported_user_id, true)} /></View>
            <View style={{ flex: 1 }}><Button title={t('resolve')} variant="secondary" onPress={() => resolve(r.id)} /></View>
          </Row>
        </Card>
      ))}

      <H2>{t('admin_suspended')} ({suspended.length})</H2>
      {suspended.length === 0 && <P muted>{t('none')}</P>}
      {suspended.map((s) => (
        <Card key={s.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{s.first_name} {s.last_name} ({s.role})</Text>
              <P muted>{s.suspended_reason === 'auto_3_reports' ? t('auto_suspended') : s.suspended_reason}</P>
            </View>
            <Button title={t('unsuspend')} variant="secondary" onPress={() => suspend(s.id, false)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}

function VerificationCard({ v, person, onReview }: { v: Verification; person?: Person; onReview: (ok: boolean) => void }) {
  const { t } = useI18n();
  const paths = [v.front_path, v.back_path, v.selfie_path].filter(Boolean) as string[];
  const urls = useSignedUrls('id-documents', paths);
  return (
    <Card>
      <Text style={{ fontWeight: '700' }}>{person ? `${person.first_name} ${person.last_name} · ${person.role}` : v.user_id}</Text>
      {person && <P muted>{t('birth_date')}: {person.birth_date} · {person.city}</P>}
      <P muted>{t(`doc_${v.doc_type}` as StringKey)}</P>
      <Row style={{ flexWrap: 'wrap' }}>
        {paths.map((p) => urls[p] ? <Image key={p} source={{ uri: urls[p] }} style={{ width: 100, height: 70, borderRadius: 6 }} /> : null)}
      </Row>
      <Row>
        <View style={{ flex: 1 }}><Button title={t('approve')} onPress={() => onReview(true)} /></View>
        <View style={{ flex: 1 }}><Button title={t('reject')} variant="secondary" onPress={() => onReview(false)} /></View>
      </Row>
    </Card>
  );
}
