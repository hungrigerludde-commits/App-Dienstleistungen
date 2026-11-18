import { useState } from 'react';
import { Button, ErrorText, Field, Screen } from '@/components/ui';
import { notify } from '@/lib/dialog';
import { errorText, supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(errorText(error));
    // Bei Erfolg leitet das Root-Layout automatisch weiter.
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('Bitte gib zuerst deine E-Mail-Adresse ein.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) setError(errorText(error));
    else notify('E-Mail gesendet', 'Wir haben dir einen Link zum Zurücksetzen des Passworts geschickt.');
  }

  return (
    <Screen>
      <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <ErrorText>{error}</ErrorText>
      <Button title="Anmelden" onPress={login} loading={busy} />
      <Button title="Passwort vergessen?" variant="ghost" onPress={resetPassword} />
    </Screen>
  );
}
