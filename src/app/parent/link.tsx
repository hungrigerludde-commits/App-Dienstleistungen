import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ErrorText, Field, P, Screen } from '@/components/ui';
import { errorMessage, useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function LinkChild() {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function link() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.rpc('link_child', { code: code.trim() });
    setBusy(false);
    if (error) return setError(errorMessage(t, error));
    router.replace({ pathname: '/parent/child/[id]', params: { id: data as string } });
  }

  return (
    <Screen>
      <P>{t('link_child_hint')}</P>
      <Field label={t('code')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={8} placeholder="3FA9C21B" />
      <ErrorText>{error}</ErrorText>
      <Button title={t('link')} onPress={link} loading={busy} disabled={code.trim().length !== 8} />
    </Screen>
  );
}
