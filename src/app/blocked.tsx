import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Button, Card, Empty, Row, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Blocked = { id: string; display_name: string; blocked_at: string };

export default function BlockedUsers() {
  const me = useProfile();
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

  if (list.length === 0) return <Screen><Empty title="Niemand blockiert" /></Screen>;
  return (
    <Screen>
      {list.map((b) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600', flex: 1 }}>{b.display_name}</Text>
            <Button title="Entsperren" variant="secondary" onPress={() => unblock(b.id)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
