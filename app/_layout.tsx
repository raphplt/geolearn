import { useEffect } from 'react';
import { AppState, useColorScheme, View } from 'react-native';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Fraunces_700Bold_Italic } from '@expo-google-fonts/fraunces/700Bold_Italic';
import { Fraunces_900Black } from '@expo-google-fonts/fraunces/900Black';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono/700Bold';
import { Spectral_400Regular } from '@expo-google-fonts/spectral/400Regular';
import { Spectral_400Regular_Italic } from '@expo-google-fonts/spectral/400Regular_Italic';
import { Spectral_500Medium } from '@expo-google-fonts/spectral/500Medium';
import { Spectral_600SemiBold } from '@expo-google-fonts/spectral/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setHapticsEnabled } from '@/fx/haptics';
import { probe } from '@/fx/probe';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { colorSchemes, motion, ThemeProvider } from '@/theme';
import { ProbeOverlay } from '@/ui/Probe';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_700Bold_Italic,
    Fraunces_900Black,
    Spectral_400Regular,
    Spectral_400Regular_Italic,
    Spectral_500Medium,
    Spectral_600SemiBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  const hydrated = useProgress((s) => s.hydrated);
  const settings = useProgress((s) => s.settings);
  const ink = useProgress((s) => s.purse.ink);
  const resolvedScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const loadResumable = useSession((s) => s.loadResumable);
  const suspendSession = useSession((s) => s.suspend);
  const wakeSession = useSession((s) => s.wake);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  useEffect(() => {
    void loadResumable();
  }, [loadResumable]);

  useEffect(() => {
    probe.enable(settings.probe);
  }, [settings.probe]);

  /*
   * A game is not played while the application is in the background. Without
   * this, a phone call in the middle of an expedition emptied the time bank in
   * silence, and the player came back to a game they had already lost.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') wakeSession();
      else suspendSession();
    });
    return () => subscription.remove();
  }, [suspendSession, wakeSession]);

  const ready = (fontsLoaded || fontError !== null) && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const scheme = settings.scheme === 'system' ? resolvedScheme : settings.scheme;
  const canvas = colorSchemes[scheme].canvas;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={settings.scheme} ink={ink}>
          <View style={{ flex: 1, backgroundColor: canvas }}>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: canvas },
                animation: 'slide_from_right',
                animationDuration: motion.duration.emphasis,
              }}
            >
              {/* Tabs are persistent: returning to one never replays anything. */}
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />

              {/* Immersive: the game takes the whole screen and owns its exit. */}
              <Stack.Screen name="play" options={{ gestureEnabled: false, animation: 'fade' }} />
              <Stack.Screen
                name="decouverte"
                options={{ gestureEnabled: false, animation: 'fade' }}
              />
              <Stack.Screen
                name="results"
                options={{ gestureEnabled: false, animation: 'slide_from_right' }}
              />

              {/* A deeper level of the same place: pushed sideways, native back. */}
              <Stack.Screen name="comptoir" />

              <Stack.Screen
                name="jaugeage"
                options={{ gestureEnabled: false, animation: 'fade' }}
              />
              <Stack.Screen
                name="onboarding"
                options={{ gestureEnabled: false, animation: 'none' }}
              />
            </Stack>
            <ProbeOverlay />
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
