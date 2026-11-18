import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, P, Screen } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';

export default function LinkChild() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function link() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.rpc('link_child', { code: code.trim() });
    setBusy(false);
    if (error) return setError(errorText(error));
    router.replace({ pathname: '/parent/child/[id]', params: { id: data as string } });
  }

  return (
    <Screen>
      <P>Dein Kind findet den 8-stelligen Code in seiner App unter „Mein Profil“.</P>
      <Field label="Code" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" maxLength={8}
        placeholder="z. B. 3FA9C21B" />
      <ErrorText>{error}</ErrorText>
      <Button title="Verknüpfen" onPress={link} loading={busy} disabled={code.trim().length !== 8} />
    </Screen>
  );
}
