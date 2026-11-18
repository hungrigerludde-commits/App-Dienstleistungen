import { useState } from 'react';
import { Banner, Button, ErrorText, Field, Screen } from '@/components/ui';
import { errorMessage, useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function Register() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function register() {
    setError(null);
    if (password.length < 8) return setError(t('password_short'));
    if (password !== password2) return setError(t('passwords_differ'));
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(errorMessage(t, error));
    if (!data.session) setSent(true);
  }

  if (sent) return <Screen><Banner tone="success">{t('confirm_email_sent')}</Banner></Screen>;

  return (
    <Screen>
      <Field label={t('email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label={t('password')} value={password} onChangeText={setPassword} secureTextEntry hint={t('password_hint')} autoComplete="new-password" />
      <Field label={t('password_repeat')} value={password2} onChangeText={setPassword2} secureTextEntry autoComplete="new-password" />
      <ErrorText>{error}</ErrorText>
      <Button title={t('create_account')} onPress={register} loading={busy} />
    </Screen>
  );
}
