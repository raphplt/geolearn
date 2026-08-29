import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES } from '@/data';
import { FLAG_ATTRIBUTION } from '@/data/flags';
import { useTheme } from '@/theme';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';

export default function Attributions() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const sources = [
    { title: 'Départements français', body: ATLASES['france-departments'].attribution },
    { title: 'Frontières mondiales', body: ATLASES['world-countries'].attribution },
    { title: 'Drapeaux', body: FLAG_ATTRIBUTION },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <ScreenHeader eyebrow="Cabine" title="Sources et attributions" />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: insets.bottom + theme.space.xxl,
          gap: theme.space.xl,
        }}
      >
        <Text variant="body" color="textSecondary" style={{ marginTop: theme.space.md }}>
          Portulan fonctionne entièrement hors ligne. Les jeux de données ci-dessous sont embarqués
          dans l’application, retravaillés pour l’affichage, et redistribués sous leurs licences
          respectives.
        </Text>

        {sources.map((source) => (
          <View key={source.title} style={{ gap: theme.space.xs }}>
            <Text variant="cartouche" color="textTertiary">
              {source.title}
            </Text>
            <Text variant="bodySm" color="textSecondary">
              {source.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
