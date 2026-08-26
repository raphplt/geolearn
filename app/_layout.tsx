import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
/*
 * Polices importées par **sous-chemin**, une par une.
 *
 * L'index racine de chaque paquet `@expo-google-fonts` fait un `require` de
 * *toutes* ses graisses — dix-huit pour Fraunces, quatorze pour Spectral. En
 * important depuis la racine, Metro embarquait les cinquante-cinq fichiers, soit
 * 6,4 Mo d'assets pour les dix que l'application utilise réellement. Les
 * sous-chemins ne résolvent qu'un fichier chacun.
 */
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
import { useProgress } from '@/store/progress';
import { colorSchemes, ThemeProvider } from '@/theme';

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
  const resolvedScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  /*
   * On attend **et** les polices **et** la progression relue.
   *
   * Lever l'écran de démarrage dès les polices prêtes ferait apparaître une
   * série à zéro puis, une fraction de seconde plus tard, la vraie valeur : le
   * joueur croit un instant avoir tout perdu. Une police manquante n'est en
   * revanche pas un motif de blocage — mieux vaut un rendu de secours qu'un
   * écran de démarrage qui ne se lève jamais.
   */
  const ready = (fontsLoaded || fontError !== null) && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  /* Le fond du conteneur doit résoudre la préférence « système » comme le fait
     le ThemeProvider : s'en tenir à `settings.scheme` peindrait un fond clair
     derrière une interface sombre sur un appareil en mode nuit. */
  const scheme = settings.scheme === 'system' ? resolvedScheme : settings.scheme;
  const canvas = colorSchemes[scheme].canvas;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={settings.scheme}>
          <View style={{ flex: 1, backgroundColor: canvas }}>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: canvas },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="play" options={{ gestureEnabled: false }} />
              <Stack.Screen name="results" options={{ gestureEnabled: false }} />
              <Stack.Screen name="atlas" />
            </Stack>
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
