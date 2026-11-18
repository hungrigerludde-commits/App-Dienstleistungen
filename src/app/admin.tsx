import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Banner, Button, Card, Empty, H2, P, Row, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { REPORT_REASONS } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';

type Pending = { id: string; role: string; first_name: string; last_name: string; phone: string | null; city: string; created_at: string };
type ReportRow = {
  id: string; reporter_id: string; reported_user_id: string | null; job_id: string | null;
  reason: string; details: string | null; created_at: string;
};

export default function Admin() {
  const me = useProfile();
  const [pending, setPending] = useState<Pending[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.rpc('admin_pending_verifications'),
      supabase.from('reports').select('*').eq('status', 'open').order('created_at'),
    ]);
    setPending((p ?? []) as Pending[]);
    const rs = (r ?? []) as ReportRow[];
    setReports(rs);
    const ids = [...new Set(rs.flatMap((x) => [x.reporter_id, x.reported_user_id]).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id, first_name, last_name, role').in('id', ids);
      setNames(Object.fromEntries((ps ?? []).map((x) => [x.id, `${x.first_name} ${x.last_name} (${x.role})`])));
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function verify(id: string, status: 'verified' | 'rejected') {
    const { error } = await supabase.rpc('admin_set_verification', { target: id, status });
    if (error) notify('Fehler', errorText(error));
    load();
  }

  async function suspend(id: string) {
    if (!(await confirm('Konto sperren?', 'Alle offenen Aufträge dieses Nutzers werden abgesagt.', 'Sperren', true))) return;
    const { error } = await supabase.rpc('admin_set_suspended', { target: id, suspended: true });
    if (error) notify('Fehler', errorText(error));
    load();
  }

  async function resolve(id: string) {
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', id);
    load();
  }

  if (!me.is_admin) return <Screen><Empty title="Kein Zugriff" /></Screen>;

  return (
    <Screen>
      <Banner>Verifiziere Auftraggeber nur nach einem Telefonat oder Ausweis-Check. Im Zweifel: ablehnen.</Banner>

      <H2>Offene Verifizierungen ({pending.length})</H2>
      {pending.length === 0 && <P muted>Keine.</P>}
      {pending.map((p) => (
        <Card key={p.id}>
          <Text style={{ fontWeight: '700' }}>{p.first_name} {p.last_name} · {p.role}</Text>
          <P>📞 {p.phone ?? '–'} · {p.city}</P>
          <P muted>Registriert am {new Date(p.created_at).toLocaleDateString('de-DE')}</P>
          <Row>
            <Button title="Verifizieren" onPress={() => verify(p.id, 'verified')} />
            <Button title="Ablehnen" variant="secondary" onPress={() => verify(p.id, 'rejected')} />
          </Row>
        </Card>
      ))}

      <H2>Offene Meldungen ({reports.length})</H2>
      {reports.length === 0 && <P muted>Keine.</P>}
      {reports.map((r) => (
        <Card key={r.id}>
          <Text style={{ fontWeight: '700' }}>{REPORT_REASONS.find((x) => x.key === r.reason)?.label ?? r.reason}</Text>
          <P>Von: {names[r.reporter_id] ?? r.reporter_id}</P>
          <P>Gegen: {r.reported_user_id ? names[r.reported_user_id] ?? r.reported_user_id : '–'}</P>
          {r.details ? <P muted>{r.details}</P> : null}
          <Row>
            {r.reported_user_id && <Button title="Sperren" variant="danger" onPress={() => suspend(r.reported_user_id!)} />}
            <Button title="Erledigt" variant="secondary" onPress={() => resolve(r.id)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
