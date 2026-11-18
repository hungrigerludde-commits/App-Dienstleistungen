import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Banner, Button, Card, ErrorText, Field, H2, P, Row, Screen, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ageOn, parseGermanDate, toIsoDate } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';
import type { Role } from '@/lib/types';

const ROLES: { key: Role; title: string; text: string; icon: string }[] = [
  { key: 'student', title: 'Ich bin Schüler/in', text: 'Ich möchte helfen und Geld verdienen (ab 14 Jahren).', icon: '🎒' },
  { key: 'client', title: 'Ich suche Hilfe', text: 'Ich möchte Schüler für Aufgaben buchen (ab 18 Jahren).', icon: '🏡' },
  { key: 'parent', title: 'Ich bin Elternteil', text: 'Ich möchte das Konto meines Kindes freigeben und begleiten.', icon: '👪' },
];

export default function Onboarding() {
  const { session, refreshProfile, signOut } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birth, setBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [plz, setPlz] = useState('');
  const [fullTimeSchool, setFullTimeSchool] = useState(true);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!role) {
    return (
      <Screen>
        <H2>Wer bist du?</H2>
        {ROLES.map((r) => (
          <Card key={r.key} onPress={() => setRole(r.key)}>
            <Row>
              <Text style={{ fontSize: 32 }}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 16 }}>{r.title}</Text>
                <P muted>{r.text}</P>
              </View>
            </Row>
          </Card>
        ))}
        <Button title="Abmelden" variant="ghost" onPress={signOut} />
      </Screen>
    );
  }

  async function save() {
    setError(null);
    const birthDate = parseGermanDate(birth);
    if (!firstName.trim() || !lastName.trim()) return setError('Bitte gib Vor- und Nachnamen ein.');
    if (!birthDate) return setError('Bitte gib dein Geburtsdatum im Format TT.MM.JJJJ ein.');
    const age = ageOn(birthDate);
    if (role === 'student' && age < 14) return setError('Du musst mindestens 14 Jahre alt sein.');
    if (role !== 'student' && age < 18) return setError('Auftraggeber und Eltern müssen volljährig sein.');
    if (!/^\d{5}$/.test(plz.trim())) return setError('Bitte gib eine gültige Postleitzahl (5 Ziffern) ein.');
    if (!city.trim()) return setError('Bitte gib deine Stadt ein.');
    if (role === 'client' && phone.trim().length < 6) return setError('Bitte gib eine Telefonnummer für die Verifizierung an.');
    if (!terms) return setError('Bitte akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung.');

    setBusy(true);
    const { error } = await supabase.from('profiles').insert({
      id: session!.user.id,
      role,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      birth_date: toIsoDate(birthDate),
      phone: phone.trim() || null,
      city: city.trim(),
      postal_code: plz.trim(),
      full_time_school: role === 'student' ? fullTimeSchool : true,
      accepted_terms_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return setError(errorText(error));
    await refreshProfile();
  }

  const isStudent = role === 'student';

  return (
    <Screen>
      <Button title="← Andere Rolle wählen" variant="ghost" onPress={() => setRole(null)} />
      <H2>{ROLES.find((r) => r.key === role)!.title}</H2>

      {isStudent && (
        <Banner>
          Öffentlich sichtbar sind nur dein Vorname, der erste Buchstabe deines Nachnamens und dein Alter
          (z. B. „Lena M., 15“). Dein voller Name ist nur für dich, deine Eltern und das Moderationsteam sichtbar.
        </Banner>
      )}

      <Field label="Vorname" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
      <Field label="Nachname" value={lastName} onChangeText={setLastName} autoComplete="family-name" />
      <Field label="Geburtsdatum" value={birth} onChangeText={setBirth} placeholder="TT.MM.JJJJ" keyboardType="numbers-and-punctuation" />
      <Field label="Postleitzahl" value={plz} onChangeText={setPlz} keyboardType="number-pad" maxLength={5} />
      <Field label="Stadt" value={city} onChangeText={setCity} autoComplete="postal-address-locality" />
      {role !== 'student' && (
        <Field
          label={role === 'client' ? 'Telefonnummer (für die Verifizierung)' : 'Telefonnummer (optional)'}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          hint="Wird nie öffentlich angezeigt."
        />
      )}

      {isStudent && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>Ich gehe noch zur Schule (vollzeitschulpflichtig)</Text>
              <P muted>Dann gelten strengere Jugendschutz-Zeiten: nur 8–18 Uhr, max. 2 Std. pro Tag.</P>
            </View>
            <Switch value={fullTimeSchool} onValueChange={setFullTimeSchool} />
          </Row>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>
            Ich akzeptiere die{' '}
            <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/terms')}>Nutzungsbedingungen</Text>
            {' '}und die{' '}
            <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/privacy')}>Datenschutzerklärung</Text>.
          </Text>
          <Switch value={terms} onValueChange={setTerms} />
        </Row>
      </Card>

      {isStudent && (
        <P muted>Unter 18? Nach dem Speichern bekommst du einen Code für deine Eltern. Erst wenn sie zustimmen, ist dein Profil sichtbar.</P>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="Profil speichern" onPress={save} loading={busy} />
    </Screen>
  );
}
