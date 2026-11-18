import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Chip, ChipRow, ErrorText, Field, P, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { notify } from '@/lib/dialog';
import { REPORT_REASONS } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';

export default function Report() {
  const { userId, jobId } = useLocalSearchParams<{ userId?: string; jobId?: string }>();
  const me = useProfile();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!reason) return setError('Bitte wähle einen Grund.');
    setBusy(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: me.id, reported_user_id: userId ?? null, job_id: jobId ?? null,
      reason, details: details.trim() || null,
    });
    setBusy(false);
    if (error) return setError(errorText(error));
    notify('Danke für deine Meldung', 'Unser Team schaut sich das so schnell wie möglich an.');
    router.back();
  }

  return (
    <Screen>
      <Banner tone="danger">
        Bist du in Gefahr? Ruf sofort die Polizei unter 110 an. Hilfe für Kinder und Jugendliche: Nummer gegen Kummer 116 111 (kostenlos).
      </Banner>
      <P style={{ fontWeight: '600' }}>Was ist passiert?</P>
      <ChipRow>
        {REPORT_REASONS.map((r) => <Chip key={r.key} label={r.label} selected={reason === r.key} onPress={() => setReason(r.key)} />)}
      </ChipRow>
      <Field label="Beschreibung (optional)" value={details} onChangeText={setDetails} multiline maxLength={2000} />
      <P muted>Die gemeldete Person erfährt nicht, wer sie gemeldet hat.</P>
      <ErrorText>{error}</ErrorText>
      <Button title="Meldung senden" onPress={send} loading={busy} />
    </Screen>
  );
}
