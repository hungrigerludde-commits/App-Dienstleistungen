import { useState } from 'react';
import { Banner, Button, ErrorText, Field, P, Screen } from '@/components/ui';
import { errorText, supabase } from '@/lib/supabase';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function register() {
    setError(null);
    if (password.length < 8) return setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
    if (password !== password2) return setError('Die Passwörter stimmen nicht überein.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(errorText(error));
    // Ist E-Mail-Bestätigung aktiv, gibt es noch keine Session.
    if (!data.session) setSent(true);
  }

  if (sent) {
    return (
      <Screen>
        <Banner tone="success">
          Fast geschafft! Wir haben dir eine E-Mail geschickt. Klicke auf den Link darin und melde dich danach an.
        </Banner>
      </Screen>
    );
  }

  return (
    <Screen>
      <P muted>Im nächsten Schritt legst du dein Profil an und wählst, ob du Schüler, Auftraggeber oder Elternteil bist.</P>
      <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Passwort" value={password} onChangeText={setPassword} secureTextEntry hint="Mindestens 8 Zeichen" autoComplete="new-password" />
      <Field label="Passwort wiederholen" value={password2} onChangeText={setPassword2} secureTextEntry autoComplete="new-password" />
      <ErrorText>{error}</ErrorText>
      <Button title="Konto erstellen" onPress={register} loading={busy} />
    </Screen>
  );
}
