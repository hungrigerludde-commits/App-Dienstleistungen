import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Badge, Banner, Button, Card, H2, P, Screen, colors } from '@/components/ui';
import { useAuth, useProfile } from '@/lib/auth';
import { confirm, notify } from '@/lib/dialog';
import { errorText, supabase } from '@/lib/supabase';

const ROLE_LABEL = { student: 'Schüler/in', client: 'Auftraggeber/in', parent: 'Elternteil' };

const VERIFICATION = {
  none: { label: 'Nicht verifiziert', color: colors.muted },
  requested: { label: 'Wird geprüft', color: '#B26A00' },
  verified: { label: 'Verifiziert ✓', color: colors.success },
  rejected: { label: 'Abgelehnt', color: colors.danger },
};

export default function Account() {
  const me = useProfile();
  const { session, signOut, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  async function requestVerification() {
    if (!me.phone) {
      notify('Telefonnummer fehlt', 'Bitte trage zuerst unter „Profil bearbeiten“ deine Telefonnummer ein.');
      return;
    }
    const { error } = await supabase.from('profiles').update({ verification_status: 'requested' }).eq('id', me.id);
    if (error) notify('Fehler', errorText(error));
    else notify('Anfrage gesendet', 'Unser Team meldet sich telefonisch bei dir, um deine Identität zu bestätigen.');
    refreshProfile();
  }

  async function deleteAccount() {
    const ok = await confirm(
      'Konto endgültig löschen?',
      'Dein Profil, deine Angebote, Aufträge und Nachrichten werden unwiderruflich gelöscht.',
      'Löschen', true,
    );
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc('delete_my_account');
    setBusy(false);
    if (error) return notify('Fehler', errorText(error));
    await signOut();
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontWeight: '800', fontSize: 18 }}>{me.first_name} {me.last_name}</Text>
        <P muted>{ROLE_LABEL[me.role]} · {session?.user.email}</P>
        {me.role !== 'student' && <Badge {...VERIFICATION[me.verification_status]} />}
        <Button title="Profil bearbeiten" variant="secondary" onPress={() => router.push('/profile/edit')} />
      </Card>

      {me.role === 'client' && ['none', 'rejected'].includes(me.verification_status) && (
        <Banner tone="warning">
          <P>Zum Schutz der Schüler prüfen wir jeden Auftraggeber, bevor er Anfragen senden kann.</P>
          <Button title="Verifizierung beantragen" onPress={requestVerification} />
        </Banner>
      )}

      {me.role === 'student' && (
        <Card>
          <H2>Jugendschutz</H2>
          <P>
            {me.full_time_school
              ? 'Du bist als vollzeitschulpflichtig eingetragen: Aufträge nur zwischen 8 und 18 Uhr, höchstens 2 Stunden pro Tag.'
              : 'Aufträge nur zwischen 6 und 20 Uhr, höchstens 8 Stunden pro Tag (bis 18 Jahre).'}
          </P>
          <P muted>Die App achtet automatisch darauf.</P>
        </Card>
      )}

      {me.is_admin && <Button title="🛠 Moderation (Admin)" onPress={() => router.push('/admin')} />}

      <Card>
        <Button title="🛡️ Sicherheitstipps" variant="ghost" onPress={() => router.push('/legal/safety')} />
        <Button title="🚫 Blockierte Nutzer" variant="ghost" onPress={() => router.push('/blocked')} />
        <Button title="📄 Nutzungsbedingungen" variant="ghost" onPress={() => router.push('/legal/terms')} />
        <Button title="🔒 Datenschutz" variant="ghost" onPress={() => router.push('/legal/privacy')} />
      </Card>

      <Button title="Abmelden" variant="secondary" onPress={signOut} />
      <Button title="Konto löschen" variant="danger" onPress={deleteAccount} loading={busy} />
    </Screen>
  );
}
