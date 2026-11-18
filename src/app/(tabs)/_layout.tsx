import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { colors } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export const unstable_settings = { initialRouteName: 'index' };

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}
const icon = (emoji: string) => function Icon({ focused }: { focused: boolean }) {
  return <TabIcon emoji={emoji} focused={focused} />;
};

/** Vier Reiter wie bei Instagram: Start, Karte, Chats, Profil. */
export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab_start'), tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="map" options={{ title: t('tab_map'), tabBarIcon: icon('🗺️') }} />
      <Tabs.Screen name="chats" options={{ title: t('tab_chats'), tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="profile" options={{ title: t('tab_profile'), tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
