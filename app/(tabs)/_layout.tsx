import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { PaperTabBar } from '@/ui/nav/TabBar';

export default function TabsLayout() {
  const theme = useTheme();
  const onboarded = useProgress((s) => s.settings.onboarded);

  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={PaperTabBar}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Cap' }} />
      <Tabs.Screen name="atlas" options={{ title: 'Atlas' }} />
      <Tabs.Screen name="brevets" options={{ title: 'Brevets' }} />
      <Tabs.Screen name="cabine" options={{ title: 'Cabine' }} />
    </Tabs>
  );
}
