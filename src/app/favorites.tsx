import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Card, Empty, Row, Screen, Stars } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

type Fav = { id: string; display_name: string; role: string; avg_rating: number | null };

export default function Favorites() {
  const { t } = useI18n();
  const [list, setList] = useState<Fav[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('my_favorites');
    setList((data ?? []) as Fav[]);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!list.length) return <Screen><Empty title={t('favorites')} text={t('no_favorites')} /></Screen>;
  return (
    <Screen>
      {list.map((f) => (
        <Card key={f.id} onPress={f.role === 'student' ? () => router.push({ pathname: '/student/[id]', params: { id: f.id } }) : undefined}>
          <Row>
            <Avatar name={f.display_name} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>♥ {f.display_name}</Text>
              <Stars value={f.avg_rating ?? 0} />
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
