import { router } from 'expo-router';
import { Text, View } from 'react-native';
import LanguageSwitch from '@/components/LanguageSwitch';
import { Button, Card, H1, P, Screen, colors } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export default function Welcome() {
  const { t } = useI18n();
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ alignItems: 'flex-end' }}><LanguageSwitch /></View>
      <View style={{ alignItems: 'center', marginTop: 16, gap: 10 }}>
        <Text style={{ fontSize: 64 }}>🤝</Text>
        <H1>{t('app_name')}</H1>
        <P muted style={{ textAlign: 'center' }}>{t('tagline')}</P>
      </View>
      <Card>
        <P>{t('welcome_feature_1')}</P>
        <P>{t('welcome_feature_2')}</P>
        <P>{t('welcome_feature_3')}</P>
      </Card>
      <Card style={{ backgroundColor: colors.infoBg, borderColor: colors.infoBg }}>
        <P>{t('welcome_safety')}</P>
      </Card>
      <View style={{ gap: 10, marginTop: 10 }}>
        <Button title={t('register')} onPress={() => router.push('/register')} />
        <Button title={t('have_account')} variant="secondary" onPress={() => router.push('/login')} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 }}>
        <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/terms')}>{t('terms')}</Text>
        <Text style={{ color: colors.primary }} onPress={() => router.push('/legal/privacy')}>{t('privacy')}</Text>
      </View>
    </Screen>
  );
}
