import { useMemo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ATLASES, type AtlasId } from '@/data';
import { rankProgress } from '@/game/economy';
import { currentRung, rungAt, rungProgress } from '@/game/ladder';
import { masteryOf } from '@/game/mastery';
import { dueCount } from '@/game/revision';
import { dailyKey } from '@/game/rng';
import { tap } from '@/fx/haptics';
import { AtlasSilhouette } from '@/map/AtlasSilhouette';
import { selectDailyDone, useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Hud, type HudChip } from '@/ui/Hud';
import { IconAtlas, IconDoublon, IconSeal } from '@/ui/icons';
import { Text } from '@/ui/Text';

const ATLAS_NAME: Record<AtlasId, string> = {
  'france-departments': 'France',
  'world-countries': 'Monde',
};

export default function Cap() {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const settings = useProgress((s) => s.settings);
  const daily = useProgress((s) => s.daily);
  const cards = useProgress((s) => s.cards);
  const purse = useProgress((s) => s.purse);

  const atlasId = settings.lastAtlas;
  const atlas = ATLASES[atlasId];
  const dailyDone = useProgress((s) => selectDailyDone(s, dailyKey()));

  const mastery = useMemo(() => masteryOf(cards, atlasId, atlas), [cards, atlasId, atlas]);
  const rungIndex = useMemo(
    () => currentRung(atlasId, cards, settings.floor),
    [atlasId, cards, settings.floor],
  );
  const rung = rungAt(atlasId, rungIndex);
  const progress = useMemo(
    () => rungProgress(atlasId, cards, rungIndex),
    [atlasId, cards, rungIndex],
  );
  const due = useMemo(() => dueCount(cards, atlasId, Date.now()), [cards, atlasId]);
  const rank = rankProgress(purse.xp);

  const chips: HudChip[] = [
    { key: 'doublons', value: `${purse.doublons}`, tone: 'reward', icon: IconDoublon },
    { key: 'streak', value: `${daily.currentStreak}`, tone: 'danger', icon: IconSeal },
    { key: 'mastered', value: `${mastery.mastered}`, tone: 'success', icon: IconAtlas },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <Hud chips={chips} rank={{ name: rank.current.name, ratio: rank.ratio }} />

      <Animated.View
        entering={FadeIn.duration(400)}
        style={{ flex: 1, paddingHorizontal: theme.space.xl }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }} pointerEvents="none">
          <AtlasSilhouette atlas={atlas} opacity={0.22} />
        </View>

        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <Text variant="cartouche" color="textTertiary">
            {ATLAS_NAME[atlasId]}
          </Text>
          <Text variant="display">{rung.name}</Text>
          <View
            style={{
              width: Math.min(width * 0.5, 220),
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.colors.surfaceSunk,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(progress.ratio * 100, progress.ratio > 0 ? 4 : 0)}%`,
                height: '100%',
                backgroundColor: theme.colors.success,
              }}
            />
          </View>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(360)}
        style={{ paddingHorizontal: theme.space.xl, paddingBottom: theme.space.lg }}
      >
        <Button
          label="Jouer"
          size="lg"
          tone="danger"
          block
          onPress={() => router.push('/embarquer')}
        />

        <Pressable
          onPress={() => {
            tap();
            router.push('/embarquer');
          }}
          accessibilityRole="button"
          accessibilityLabel="Relevé du jour"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space.sm,
            minHeight: theme.hitTarget.min,
            marginTop: theme.space.sm,
          }}
        >
          <Text variant="labelSm" color={due > 0 ? 'danger' : dailyDone ? 'textTertiary' : 'reward'}>
            {due > 0 ? `${due} à réviser` : dailyDone ? 'Relevé rendu' : 'Relevé du jour'}
          </Text>
          {due > 0 || !dailyDone ? (
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: due > 0 ? theme.colors.danger : theme.colors.reward,
              }}
            />
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}
