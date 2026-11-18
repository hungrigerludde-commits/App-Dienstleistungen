import { goBack } from '@/lib/nav';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, P, Row, Screen } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { errorMessage, useI18n } from '@/lib/i18n';
import { containsContactData } from '@/lib/rules';
import { supabase } from '@/lib/supabase';

export default function EditProfile() {
  const me = useProfile();
  const { refreshProfile } = useAuth();
  const { t } = useI18n();
  const [firstName, setFirstName] = useState(me.first_name);
  const [lastName, setLastName] = useState(me.last_name);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [city, setCity] = useState(me.city);
  const [plz, setPlz] = useState(me.postal_code);
  const [bio, setBio] = useState(me.bio ?? '');
  const [availability, setAvailability] = useState(me.availability_note ?? '');
  const [fullTimeSchool, setFullTimeSchool] = useState(me.full_time_school);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isStudent = me.role === 'student';
  const locked = me.verification_status === 'verified';

  async function save() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError(t('err_name'));
    if (!/^\d{5}$/.test(plz)) return setError(t('err_plz'));
    if (containsContactData(bio) || containsContactData(availability)) return setError(t('ERR_CONTACT_DATA'));
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null,
      city: city.trim(), postal_code: plz, bio: bio.trim() || null,
      availability_note: availability.trim() || null, full_time_school: fullTimeSchool,
    }).eq('id', me.id);
    setBusy(false);
    if (error) return setError(errorMessage(t, error));
    await refreshProfile();
    goBack();
  }

  return (
    <Screen>
      <Field label={t('first_name')} value={firstName} onChangeText={setFirstName} editable={!locked} />
      <Field label={t('last_name')} value={lastName} onChangeText={setLastName} editable={!locked} hint={isStudent ? t('public_name_hint') : undefined} />
      <Field label={t('postal_code')} value={plz} onChangeText={setPlz} keyboardType="number-pad" maxLength={5} />
      <Field label={t('city')} value={city} onChangeText={setCity} />
      {!isStudent && <Field label={t('phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint={t('phone_hint')} />}
      <Field label={t('about_me')} value={bio} onChangeText={setBio} multiline maxLength={1000} placeholder={t('about_me_ph')} />
      {isStudent && (
        <>
          <Field label={t('availability')} value={availability} onChangeText={setAvailability} maxLength={300} placeholder={t('availability_ph')} />
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>{t('full_time_school')}</Text>
                <P muted>{t('full_time_school_hint')}</P>
              </View>
              <Switch value={fullTimeSchool} onValueChange={setFullTimeSchool} />
            </Row>
          </Card>
        </>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title={t('save')} onPress={save} loading={busy} />
    </Screen>
  );
}
