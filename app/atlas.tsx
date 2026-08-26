import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import { parseCardId } from '@/game/questions';
import { MASTERED_LEVEL, MAX_LEVEL } from '@/game/srs';
import { tap } from '@/fx/haptics';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

const ATLAS_NAME: Record<AtlasId, string> = {
  'france-departments': 'France',
  'world-countries': 'Monde',
};

export default function AtlasScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const cards = useProgress((s) => s.cards);
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const atlasId = settings.lastAtlas;
  const atlas = ATLASES[atlasId];

  /*
   * Maîtrise par territoire.
   *
   * Un territoire porte plusieurs cartes de révision — le situer, le nommer,
   * connaître son chef-lieu. On retient le **minimum** de leurs niveaux et non
   * la moyenne : savoir placer la Creuse sans savoir qu'elle a Guéret pour
   * chef-lieu, ce n'est pas la connaître à moitié, c'est ne pas encore la
   * maîtriser. La carte doit dire la vérité, pas flatter.
   */
  const { levels, stats } = useMemo(() => {
    const byTerritory = new Map<string, number>();
    const skillsSeen = new Map<string, number>();

    for (const [cardId, card] of Object.entries(cards)) {
      const parsed = parseCardId(cardId);
      if (!parsed || parsed.atlasId !== atlasId) continue;
      const current = byTerritory.get(parsed.territoryId);
      byTerritory.set(
        parsed.territoryId,
        current === undefined ? card.level : Math.min(current, card.level),
      );
      skillsSeen.set(parsed.territoryId, (skillsSeen.get(parsed.territoryId) ?? 0) + 1);
    }

    let mastered = 0;
    let started = 0;
    for (const level of byTerritory.values()) {
      started++;
      if (level >= MASTERED_LEVEL) mastered++;
    }

    return {
      levels: byTerritory,
      stats: { mastered, started, total: atlas.territories.filter((t) => t.d !== '').length },
    };
  }, [cards, atlasId, atlas.territories]);

  const states = useMemo(() => {
    const out: Record<string, TerritoryState> = {};
    for (const [id, level] of levels) {
      if (level >= MASTERED_LEVEL) out[id] = 'mastered';
      else if (level > 0) out[id] = 'target';
    }
    return out;
  }, [levels]);

  const progress = stats.total === 0 ? 0 : stats.mastered / stats.total;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.canvas,
        paddingTop: insets.top + theme.space.md,
      }}
    >
      <View style={{ paddingHorizontal: theme.space.lg }}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              tap();
              router.back();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Text variant="labelSm" color="textTertiary">
              Retour
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
            {(Object.keys(ATLASES) as AtlasId[]).map((id) => (
              <Pressable
                key={id}
                onPress={() => {
                  tap();
                  updateSettings({ lastAtlas: id });
                }}
                style={{
                  paddingHorizontal: theme.space.md,
                  paddingVertical: theme.space.xs,
                  borderRadius: theme.radius.pill,
                  backgroundColor:
                    id === atlasId ? theme.colors.text : 'transparent',
                }}
              >
                <Text
                  variant="labelSm"
                  color={id === atlasId ? 'textInverse' : 'textTertiary'}
                >
                  {ATLAS_NAME[id]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text variant="display" style={{ marginTop: theme.space.md }}>
          Votre atlas
        </Text>
        <Text variant="note" color="textSecondary">
          {stats.mastered} territoire{stats.mastered > 1 ? 's' : ''} en mémoire longue sur{' '}
          {stats.total}.
        </Text>

        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.colors.surfaceSunk,
            overflow: 'hidden',
            marginTop: theme.space.md,
          }}
        >
          <View
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              backgroundColor: theme.colors.success,
            }}
          />
        </View>
      </View>

      <AtlasMap
        atlas={atlas}
        states={states}
        interactive={false}
        labelThreshold={0}
        style={{ flex: 1, marginTop: theme.space.md, marginHorizontal: theme.space.sm }}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          gap: theme.space.sm,
          paddingVertical: theme.space.md,
        }}
      >
        <Legend swatch={theme.colors.mapLandIdle} label="Inconnu" />
        <Legend swatch={theme.colors.mapTarget} label="En cours" />
        <Legend swatch={theme.colors.mapLand} label={`Acquis (boîte ${MASTERED_LEVEL}+)`} />
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: insets.bottom + theme.space.lg,
        }}
      >
        <Button
          label="Reprendre l’exploration"
          block
          onPress={() => {
            router.replace('/');
          }}
        />
        {stats.started === 0 ? (
          <Text
            variant="caption"
            color="textTertiary"
            align="center"
            style={{ marginTop: theme.space.sm }}
          >
            Jouez une première expédition pour commencer à colorer la carte.
          </Text>
        ) : (
          <Text
            variant="caption"
            color="textTertiary"
            align="center"
            style={{ marginTop: theme.space.sm }}
          >
            Un territoire n’est acquis que lorsque toutes ses questions le sont — jusqu’à la
            boîte {MAX_LEVEL}.
          </Text>
        )}
      </View>
    </View>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  const theme = useTheme();
  return (
    <PaperSurface
      tone="raised"
      bordered
      radius="pill"
      grain={0.2}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.xs,
      }}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          backgroundColor: swatch,
          borderWidth: 1,
          borderColor: theme.colors.mapStroke,
        }}
      />
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </PaperSurface>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
});
