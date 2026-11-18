import { Stack } from 'expo-router';
import { colors } from '@/components/ui';

export const unstable_settings = { initialRouteName: 'index' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerBackTitle: 'Zurück', contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Anmelden' }} />
      <Stack.Screen name="register" options={{ title: 'Registrieren' }} />
    </Stack>
  );
}
