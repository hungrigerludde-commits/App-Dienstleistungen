import { router } from 'expo-router';
import { Text } from 'react-native';
import { Badge, Card, P, Row } from './ui';
import { JOB_STATUS, categoryLabel, formatDateTime } from '@/lib/rules';
import type { Job } from '@/lib/types';

export default function JobCard({ job, otherName }: { job: Job; otherName?: string }) {
  const st = JOB_STATUS[job.status];
  return (
    <Card onPress={() => router.push({ pathname: '/job/[id]', params: { id: job.id } })}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', flex: 1 }}>{categoryLabel(job.category)}</Text>
        <Badge label={st.label} color={st.color} />
      </Row>
      <P numberOfLines={2}>{job.description}</P>
      <P muted>
        📅 {formatDateTime(job.scheduled_start)} · {job.duration_minutes} Min.
        {otherName ? ` · ${otherName}` : ''}
      </P>
    </Card>
  );
}
