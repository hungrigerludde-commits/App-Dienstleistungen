import { router } from 'expo-router';
import { Linking, Text, View } from 'react-native';
import { Badge, Button, Card, P, Row, colors } from './ui';
import { confirm, notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { JOB_STATUS_COLOR, SERVICE_ICON, formatDateTime, formatMoney, type Service } from '@/lib/rules';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import type { ChildJob } from '@/lib/types';

/** Für Eltern: wann, wo, bei wem – und eingreifen können. */
export default function ChildJobCard({ job, childName, onChanged }: { job: ChildJob; childName?: string; onChanged: () => void }) {
  const { t, lang } = useI18n();
  const open = job.status === 'requested' || job.status === 'accepted';

  async function cancel() {
    if (!(await confirm(t('cancel_job'), t('cancel_job_q'), t('yes'), true))) return;
    const { error } = await supabase.rpc('cancel_job', { job: job.job_id });
    if (error) notify(t('error'), errorMessage(t, error));
    onChanged();
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '800', flex: 1 }}>
          {childName ? `${childName}: ` : ''}{SERVICE_ICON[job.service as Service]} {job.title}
        </Text>
        <Badge label={t(`job_${job.status}` as StringKey)} color={JOB_STATUS_COLOR[job.status]} />
      </Row>
      <Line label={t('when')} value={`${formatDateTime(job.scheduled_start, lang)} · ${job.duration_minutes} ${t('minutes')}`} />
      <Line label={t('where')} value={job.street ? `${job.street}, ${job.postal_code} ${job.city}` : `${job.city ?? ''} – ${t('address_locked')}`} />
      <Line label={t('with_whom')} value={`${job.client_name}${job.client_verified ? ` (${t('verified')} ✓)` : ''}`} />
      <P muted>💶 {formatMoney(job.agreed_price, lang)} €</P>
      {open && (
        <View style={{ gap: 8 }}>
          <Button title={t('read_chat')} variant="secondary" onPress={() => router.push({ pathname: '/chat/[jobId]', params: { jobId: job.job_id } })} />
          {job.client_phone && <Button title={t('call_client')} variant="secondary" onPress={() => Linking.openURL(`tel:${job.client_phone}`)} />}
          <Row>
            <View style={{ flex: 1 }}><Button title={t('cancel_job')} variant="danger" onPress={cancel} /></View>
            <View style={{ flex: 1 }}><Button title={t('emergency')} variant="danger" onPress={() => Linking.openURL('tel:110')} /></View>
          </Row>
        </View>
      )}
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ fontSize: 15, lineHeight: 21 }}>
      <Text style={{ fontWeight: '700', color: colors.muted }}>{label}: </Text>{value}
    </Text>
  );
}
