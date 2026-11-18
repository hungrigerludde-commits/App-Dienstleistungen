import { Stack } from 'expo-router';
import { colors } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export const unstable_settings = { initialRouteName: 'index' };

export default function AuthLayout() {
  const { t } = useI18n();
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerBackTitle: t('back'), contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: t('login') }} />
      <Stack.Screen name="register" options={{ title: t('register') }} />
    </Stack>
  );
}
