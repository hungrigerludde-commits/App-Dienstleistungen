import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, P, Row, Screen } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { CONTACT_WARNING, containsContactData } from '@/lib/rules';
import { errorText, supabase } from '@/lib/supabase';

export default function EditProfile() {
  const me = useProfile();
  const { refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(me.first_name);
  const [lastName, setLastName] = useState(me.last_name);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [city, setCity] = useState(me.city);
  const [plz, setPlz] = useState(me.postal_code);
  const [bio, setBio] = useState(me.bio ?? '');
  const [availability, setAvailability] = useState(me.availability_note ?? '');
  const [radius, setRadius] = useState(String(me.radius_km));
  const [fullTimeSchool, setFullTimeSchool] = useState(me.full_time_school);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isStudent = me.role === 'student';

  async function save() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError('Bitte gib Vor- und Nachnamen ein.');
    if (!/^\d{5}$/.test(plz)) return setError('Ungültige Postleitzahl.');
    if (containsContactData(bio) || containsContactData(availability)) return setError(CONTACT_WARNING);
    const r = Number(radius);
    if (!Number.isInteger(r) || r < 1 || r > 50) return setError('Der Umkreis muss zwischen 1 und 50 km liegen.');
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || null,
      city: city.trim(), postal_code: plz, bio: bio.trim() || null,
      availability_note: availability.trim() || null, radius_km: r, full_time_school: fullTimeSchool,
    }).eq('id', me.id);
    setBusy(false);
    if (error) return setError(errorText(error));
    await refreshProfile();
    router.back();
  }

  return (
    <Screen>
      <Field label="Vorname" value={firstName} onChangeText={setFirstName} />
      <Field label="Nachname" value={lastName} onChangeText={setLastName} hint={isStudent ? 'Öffentlich wird nur der erste Buchstabe angezeigt.' : undefined} />
      <Field label="Postleitzahl" value={plz} onChangeText={setPlz} keyboardType="number-pad" maxLength={5} />
      <Field label="Stadt" value={city} onChangeText={setCity} />
      {!isStudent && <Field label="Telefonnummer" value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint="Nur für die Verifizierung, nie öffentlich." />}
      {isStudent && (
        <>
          <Field label="Über mich" value={bio} onChangeText={setBio} multiline maxLength={1000}
            placeholder="z. B. Ich bin in der 10. Klasse, spiele seit 6 Jahren Gitarre und helfe gern im Garten." />
          <Field label="Wann hast du Zeit?" value={availability} onChangeText={setAvailability} maxLength={300}
            placeholder="z. B. Mo–Fr ab 15 Uhr, Sa vormittags" />
          <Field label="Umkreis in km" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600' }}>Vollzeitschulpflichtig</Text>
                <P muted>Wenn du noch zur allgemeinbildenden Schule gehst, lass das eingeschaltet.</P>
              </View>
              <Switch value={fullTimeSchool} onValueChange={setFullTimeSchool} />
            </Row>
          </Card>
        </>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Speichern" onPress={save} loading={busy} />
    </Screen>
  );
}
