import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ATLASES, type AtlasId } from '@/data';
import { cartouchesOf, masteryOf, masteryRatio } from '@/game/mastery';
import { MASTERED_LEVEL } from '@/game/srs';
import { tap } from '@/fx/haptics';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Hud, type HudChip } from '@/ui/Hud';
import { IconAtlas, IconCap, IconSeal } from '@/ui/icons';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

const ATLAS_NAME: Record<AtlasId, string> = {
  'france-departments': 'France',
  'world-countries': 'Monde',
};

export default function AtlasScreen() {
  const theme = useTheme();

  const cards = useProgress((s) => s.cards);
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const atlasId = settings.lastAtlas;
  const atlas = ATLASES[atlasId];

  const mastery = useMemo(() => masteryOf(cards, atlasId, atlas), [cards, atlasId, atlas]);

  const cartouches = useMemo(
    () => cartouchesOf(mastery, atlasId, atlas),
    [mastery, atlasId, atlas],
  );
  const sealed = cartouches.filter((c) => c.sealed);

  const states = useMemo(() => {
    const out: Record<string, TerritoryState> = {};
    for (const [id, level] of mastery.byTerritory) {
      if (level >= MASTERED_LEVEL) out[id] = 'mastered';
      else if (level > 0) out[id] = 'target';
    }
    for (const cartouche of cartouches) {
      if (!cartouche.sealed) continue;
      for (const id of cartouche.territoryIds) out[id] = 'sealed';
    }
    return out;
  }, [mastery.byTerritory, cartouches]);

  const ratio = masteryRatio(mastery);
  const remaining = mastery.total - mastery.mastered;

  const chips: HudChip[] = [
    { key: 'mastered', value: `${mastery.mastered}`, tone: 'success', icon: IconSeal },
    { key: 'started', value: `${Math.max(0, mastery.started - mastery.mastered)}`, tone: 'reward', icon: IconCap },
    { key: 'remaining', value: `${remaining}`, tone: 'text', icon: IconAtlas },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <Hud
        chips={chips}
        trailing={
          <View style={{ flexDirection: 'row', gap: theme.space.xs }}>
            {(Object.keys(ATLASES) as AtlasId[]).map((id) => {
              const selected = id === atlasId;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    tap();
                    updateSettings({ lastAtlas: id });
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  hitSlop={6}
                  style={{
                    paddingHorizontal: theme.space.md,
                    paddingVertical: theme.space.xs,
                    borderRadius: theme.radius.pill,
                    backgroundColor: selected
                      ? theme.colors.surfaceRaised
                      : 'transparent',
                    borderWidth: theme.borderWidth.hair,
                    borderColor: selected ? theme.colors.borderStrong : 'transparent',
                  }}
                >
                  <Text variant="labelSm" color={selected ? 'text' : 'textTertiary'}>
                    {ATLAS_NAME[id]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        }
      />

      <AtlasMap
        atlas={atlas}
        states={states}
        labels="adaptive"
        style={{ flex: 1, marginHorizontal: theme.space.lg }}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          gap: theme.space.sm,
          paddingVertical: theme.space.md,
          alignItems: 'center',
        }}
      >
        <Legend swatch={theme.colors.mapLandIdle} label="À découvrir" />
        <Legend swatch={theme.colors.mapTarget} label="En cours" />
        <Legend swatch={theme.colors.mapLand} label="En mémoire" />
        {sealed.length > 0 ? (
          <Legend
            swatch={theme.colors.reward}
            label={`${sealed.length} cartouche${sealed.length > 1 ? 's' : ''} scellé${sealed.length > 1 ? 's' : ''}`}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Legend({
  swatch,
  label,
  hint = false,
}: {
  swatch?: string;
  label: string;
  hint?: boolean;
}) {
  const theme = useTheme();
  return (
    <PaperSurface
      tone={hint ? 'sunk' : 'raised'}
      bordered={hint ? 'soft' : true}
      radius="pill"
      grain={0.2}
      bevel={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
      }}
    >
      {swatch ? (
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            backgroundColor: swatch,
            borderWidth: 1,
            borderColor: theme.colors.mapStrokeStrong,
          }}
        />
      ) : null}
      <Text variant="caption" color={hint ? 'textTertiary' : 'textSecondary'}>
        {label}
      </Text>
    </PaperSurface>
  );
}
