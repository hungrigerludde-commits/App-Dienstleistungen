import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Banner, Button, Card, ErrorText, Field, H2, P, Row, Screen, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorMessage, useI18n } from '@/lib/i18n';
import { ageOn, parseGermanDate, toIsoDate } from '@/lib/rules';
import type { StringKey } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/types';

const ROLES: { key: Role; title: StringKey; text: StringKey; icon: string }[] = [
  { key: 'student', title: 'role_student', text: 'role_student_text', icon: '🎒' },
  { key: 'client', title: 'role_client', text: 'role_client_text', icon: '🏡' },
  { key: 'parent', title: 'role_parent', text: 'role_parent_text', icon: '👪' },
];

export default function Onboarding() {
  const { session, refreshProfile, signOut } = useAuth();
  const { t, lang } = useI18n();
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
        <H2>{t('who_are_you')}</H2>
        {ROLES.map((r) => (
          <Card key={r.key} onPress={() => setRole(r.key)}>
            <Row>
              <Text style={{ fontSize: 34 }}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 17 }}>{t(r.title)}</Text>
                <P muted>{t(r.text)}</P>
              </View>
            </Row>
          </Card>
        ))}
        <Button title={t('logout')} variant="ghost" onPress={signOut} />
      </Screen>
    );
  }

  async function save() {
    setError(null);
    const birthDate = parseGermanDate(birth);
    if (!firstName.trim() || !lastName.trim()) return setError(t('err_name'));
    if (!birthDate) return setError(t('err_birth'));
    const age = ageOn(birthDate);
    if (role === 'student' && age < 14) return setError(t('ERR_MIN_AGE_14'));
    if (role !== 'student' && age < 18) return setError(t('ERR_MIN_AGE_18'));
    if (!/^\d{5}$/.test(plz.trim())) return setError(t('err_plz'));
    if (!city.trim()) return setError(t('err_city'));
    if (role !== 'student' && phone.trim().length < 6) return setError(t('err_phone'));
    if (!terms) return setError(t('err_terms'));

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
      language: lang,
      full_time_school: role === 'student' ? fullTimeSchool : true,
      accepted_terms_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return setError(errorMessage(t, error));
    await refreshProfile();
  }

  return (
    <Screen>
      <Button title={t('choose_other_role')} variant="ghost" onPress={() => setRole(null)} />
      <H2>{t(ROLES.find((r) => r.key === role)!.title)}</H2>
      {role === 'student' && <Banner>{t('public_name_hint')}</Banner>}

      <Field label={t('first_name')} value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
      <Field label={t('last_name')} value={lastName} onChangeText={setLastName} autoComplete="family-name" />
      <Field label={t('birth_date')} value={birth} onChangeText={setBirth} placeholder={lang === 'de' ? 'TT.MM.JJJJ' : 'DD.MM.YYYY'} keyboardType="numbers-and-punctuation" />
      <Field label={t('postal_code')} value={plz} onChangeText={setPlz} keyboardType="number-pad" maxLength={5} />
      <Field label={t('city')} value={city} onChangeText={setCity} />
      {role !== 'student' && (
        <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint={t('phone_hint')} />
      )}

      {role === 'student' && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600' }}>{t('full_time_school')}</Text>
              <P muted>{t('full_time_school_hint')}</P>
            </View>
            <Switch value={fullTimeSchool} onValueChange={setFullTimeSchool} />
          </Row>
        </Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>
            {t('accept_terms_1')}
            <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/terms')}>{t('terms')}</Text>
            {t('and_the')}
            <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/privacy')}>{t('privacy')}</Text>.
          </Text>
          <Switch value={terms} onValueChange={setTerms} />
        </Row>
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title={t('save_profile')} onPress={save} loading={busy} />
    </Screen>
  );
}
