import { router } from 'expo-router';
import { Text } from 'react-native';
import { Badge, Card, P, Row } from './ui';
import { useI18n } from '@/lib/i18n';
import { JOB_STATUS_COLOR, SERVICE_ICON, formatDateTime, formatMoney, type Service } from '@/lib/rules';
import type { StringKey } from '@/lib/strings';
import type { Job } from '@/lib/types';

export default function JobCard({ job, otherName }: { job: Job; otherName?: string }) {
  const { t, lang } = useI18n();
  return (
    <Card onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', flex: 1 }}>{SERVICE_ICON[job.service as Service]} {job.title}</Text>
        <Badge label={t(`job_${job.status}` as StringKey)} color={JOB_STATUS_COLOR[job.status]} />
      </Row>
      <P muted>📅 {formatDateTime(job.scheduled_start, lang)} · {job.duration_minutes} {t('minutes')} · {formatMoney(job.agreed_price, lang)} €</P>
      {otherName ? <P>{otherName}</P> : null}
    </Card>
  );
}
