import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Empty, Row, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

type Blocked = { id: string; display_name: string };

export default function BlockedUsers() {
  const me = useProfile();
  const { t } = useI18n();
  const [list, setList] = useState<Blocked[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_blocked_users');
    setList((data ?? []) as Blocked[]);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function unblock(id: string) {
    await supabase.from('blocks').delete().eq('blocker_id', me.id).eq('blocked_id', id);
    load();
  }

  if (!list.length) return <Screen><Empty title={t('nobody_blocked')} /></Screen>;
  return (
    <Screen>
      {list.map((b) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600', flex: 1 }}>{b.display_name}</Text>
            <Button title={t('unblock')} variant="secondary" onPress={() => unblock(b.id)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
