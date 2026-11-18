import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { colors } from '@/components/ui';
import { useProfile } from '@/lib/auth';

// Startseite des Tab-Bereichs (wichtig für Weiterleitung nach Login)
export const unstable_settings = { initialRouteName: 'index' };

const icon = (emoji: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export default function TabsLayout() {
  const profile = useProfile();
  const homeTitle = { student: 'Mein Profil', client: 'Suchen', parent: 'Meine Kinder' }[profile.role];
  const homeIcon = { student: '🎒', client: '🔎', parent: '👪' }[profile.role];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: homeTitle, tabBarIcon: icon(homeIcon) }} />
      <Tabs.Screen name="jobs" options={{ title: 'Aufträge', tabBarIcon: icon('📋') }} />
      <Tabs.Screen name="account" options={{ title: 'Konto', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
