import { useState } from 'react';
import { Button, ErrorText, Field, Screen } from '@/components/ui';
import { notify } from '@/lib/dialog';
import { errorMessage, useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(errorMessage(t, error));
  }

  async function resetPassword() {
    if (!email.trim()) return setError(t('enter_email_first'));
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) setError(errorMessage(t, error));
    else notify(t('reset_sent'));
  }

  return (
    <Screen>
      <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <ErrorText>{error}</ErrorText>
      <Button title={t('login')} onPress={login} loading={busy} />
      <Button title={t('forgot_password')} variant="ghost" onPress={resetPassword} />
    </Screen>
  );
}
