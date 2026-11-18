import { goBack } from '@/lib/nav';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Chip, ChipRow, ErrorText, Field, H2, P, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { REPORT_REASONS } from '@/lib/rules';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';

/** Melden mit Grund. Nach 3 Meldungen wird ein Konto automatisch gesperrt. */
export default function Report() {
  const { userId, jobId } = useLocalSearchParams<{ userId: string; jobId?: string }>();
  const me = useProfile();
  const { t } = useI18n();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!reason) return setError(t('err_reason'));
    setBusy(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: me.id, reported_user_id: userId, job_id: jobId ?? null, reason, details: details.trim() || null,
    });
    setBusy(false);
    if (error) return setError(errorMessage(t, error));
    if (await confirm(t('report_thanks'), t('block_q'), t('block_user'))) {
      await supabase.from('blocks').insert({ blocker_id: me.id, blocked_id: userId });
    } else {
      notify(t('report_thanks'));
    }
    goBack();
  }

  return (
    <Screen>
      <Banner tone="danger">{t('report_emergency')}</Banner>
      <H2>{t('report_title')}</H2>
      <ChipRow>
        {REPORT_REASONS.map((r) => <Chip key={r} label={t(`report_reason_${r}` as StringKey)} selected={reason === r} onPress={() => setReason(r)} />)}
      </ChipRow>
      <Field label={t('report_details')} value={details} onChangeText={setDetails} multiline maxLength={2000} />
      <P muted>{t('report_anonymous')}</P>
      <ErrorText>{error}</ErrorText>
      <Button title={t('report_send')} onPress={send} loading={busy} />
    </Screen>
  );
}
