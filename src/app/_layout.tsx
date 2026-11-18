import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SetupMissing from '@/components/SetupMissing';
import { Loading, colors } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { isConfigured } from '@/lib/supabase';

function RootNavigator() {
  const { loading, session, profile } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;

  const loggedIn = Boolean(session);
  const ready = loggedIn && Boolean(profile);

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        headerBackTitle: t('back'),
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={loggedIn && !profile}>
        <Stack.Screen name="onboarding" options={{ title: t('onboarding_title'), headerBackVisible: false }} />
      </Stack.Protected>

      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="jobs" options={{ title: t('my_jobs') }} />
        <Stack.Screen name="posts" options={{ title: t('start_mine_client') }} />
        <Stack.Screen name="post/new" options={{ title: t('post_new') }} />
        <Stack.Screen name="post/[id]" options={{ title: t('post') }} />
        <Stack.Screen name="job/[id]" options={{ title: t('job') }} />
        <Stack.Screen name="chat/[jobId]" options={{ title: t('chats') }} />
        <Stack.Screen name="student/[id]" options={{ title: t('public_profile') }} />
        <Stack.Screen name="offer/edit" options={{ title: t('offer') }} />
        <Stack.Screen name="profile-edit" options={{ title: t('edit_profile') }} />
        <Stack.Screen name="location" options={{ title: t('location_title') }} />
        <Stack.Screen name="verify" options={{ title: t('verify_title') }} />
        <Stack.Screen name="favorites" options={{ title: t('favorites') }} />
        <Stack.Screen name="parent/link" options={{ title: t('link_child') }} />
        <Stack.Screen name="parent/child/[id]" options={{ title: t('my_children') }} />
        <Stack.Screen name="report" options={{ title: t('report'), presentation: 'modal' }} />
        <Stack.Screen name="blocked" options={{ title: t('blocked_users') }} />
        <Stack.Screen name="admin" options={{ title: t('admin') }} />
      </Stack.Protected>

      <Stack.Screen name="legal/privacy" options={{ title: t('privacy') }} />
      <Stack.Screen name="legal/terms" options={{ title: t('terms') }} />
      <Stack.Screen name="legal/safety" options={{ title: t('safety_tips') }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <I18nProvider>
        {isConfigured ? (
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        ) : (
          <SetupMissing />
        )}
      </I18nProvider>
    </SafeAreaProvider>
  );
}
