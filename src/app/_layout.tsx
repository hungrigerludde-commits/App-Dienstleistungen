import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading, colors } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';
import SetupMissing from '@/components/SetupMissing';

function RootNavigator() {
  const { loading, session, profile } = useAuth();
  if (loading) return <Loading />;

  const loggedIn = Boolean(session);
  const ready = loggedIn && Boolean(profile);

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerBackTitle: 'Zurück',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={loggedIn && !profile}>
        <Stack.Screen name="onboarding" options={{ title: 'Profil anlegen', headerBackVisible: false }} />
      </Stack.Protected>

      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="student/[id]" options={{ title: 'Profil' }} />
        <Stack.Screen name="request/[studentId]" options={{ title: 'Anfrage senden' }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Auftrag' }} />
        <Stack.Screen name="chat/[jobId]" options={{ title: 'Chat' }} />
        <Stack.Screen name="offer/edit" options={{ title: 'Angebot' }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Profil bearbeiten' }} />
        <Stack.Screen name="parent/link" options={{ title: 'Kind verknüpfen' }} />
        <Stack.Screen name="parent/child/[id]" options={{ title: 'Mein Kind' }} />
        <Stack.Screen name="report" options={{ title: 'Melden', presentation: 'modal' }} />
        <Stack.Screen name="blocked" options={{ title: 'Blockierte Nutzer' }} />
        <Stack.Screen name="admin" options={{ title: 'Moderation' }} />
      </Stack.Protected>

      {/* Rechtliches ist immer erreichbar (auch vor dem Login) */}
      <Stack.Screen name="legal/privacy" options={{ title: 'Datenschutz' }} />
      <Stack.Screen name="legal/terms" options={{ title: 'Nutzungsbedingungen' }} />
      <Stack.Screen name="legal/safety" options={{ title: 'Sicherheitstipps' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isConfigured ? (
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      ) : (
        <SetupMissing />
      )}
    </SafeAreaProvider>
  );
}
