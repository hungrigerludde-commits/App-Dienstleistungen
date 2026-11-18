import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Badge, Banner, Button, Card, Empty, P, Screen, colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { ageOn, fromIsoDate } from '@/lib/rules';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const CONSENT: Record<string, { label: string; color: string }> = {
  pending: { label: 'Zustimmung ausstehend', color: '#B26A00' },
  approved: { label: 'Freigegeben', color: colors.success },
  rejected: { label: 'Nicht freigegeben', color: colors.danger },
  not_required: { label: 'Volljährig', color: colors.muted },
};

export default function ParentHome() {
  const me = useProfile();
  const [children, setChildren] = useState<Profile[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('parent_id', me.id).order('first_name');
    setChildren((data ?? []) as Profile[]);
  }, [me.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <Banner>
        Als Elternteil gibst du das Konto deines Kindes frei. Du siehst alle Anfragen, Aufträge und Chats und kannst Aufträge jederzeit absagen.
      </Banner>
      {children && children.length === 0 && (
        <Empty title="Noch kein Kind verknüpft" text="Dein Kind sieht in der App unter „Mein Profil“ einen 8-stelligen Code. Gib ihn hier ein." />
      )}
      {children?.map((c) => (
        <Card key={c.id} onPress={() => router.push({ pathname: '/parent/child/[id]', params: { id: c.id } })}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{c.first_name} {c.last_name}, {ageOn(fromIsoDate(c.birth_date))}</Text>
          <Badge {...CONSENT[c.parent_consent]} />
          <P muted>Antippen für Details, Freigabe und Aufträge</P>
        </Card>
      ))}
      <Button title="Kind mit Code verknüpfen" onPress={() => router.push('/parent/link')} />
    </Screen>
  );
}
