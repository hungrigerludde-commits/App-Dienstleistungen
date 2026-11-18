import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, Card, H1, P, Screen, colors } from '@/components/ui';

export default function Welcome() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', marginTop: 40, gap: 10 }}>
        <Text style={{ fontSize: 64 }}>🤝</Text>
        <H1>StadtHelfer</H1>
        <P muted style={{ textAlign: 'center' }}>
          Schüler helfen in ihrer Stadt – und verdienen sich dabei etwas dazu.
        </P>
      </View>

      <Card>
        <P>📚 Nachhilfe & Musikunterricht</P>
        <P>🌿 Rasen mähen, Hecke schneiden</P>
        <P>🪟 Fenster putzen, 🛒 Einkäufe & mehr</P>
      </Card>

      <Card style={{ backgroundColor: colors.infoBg, borderColor: colors.infoBg }}>
        <P>🛡️ Sicher: Eltern stimmen zu, Auftraggeber werden geprüft, Adressen erst nach Zusage, Jugendschutz-Zeiten automatisch.</P>
      </Card>

      <View style={{ gap: 10, marginTop: 10 }}>
        <Button title="Neu registrieren" onPress={() => router.push('/register')} />
        <Button title="Ich habe schon ein Konto" variant="secondary" onPress={() => router.push('/login')} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 }}>
        <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/terms')}>Nutzungsbedingungen</Text>
        <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/privacy')}>Datenschutz</Text>
      </View>
    </Screen>
  );
}
