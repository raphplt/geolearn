import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import { currentRung, undiscovered } from '@/game/ladder';
import { dailyKey, seedFrom } from '@/game/rng';
import { dueCount, dueQueue, REVISION_BATCH } from '@/game/revision';
import { dailyConfig, expeditionConfig, lessonConfig } from '@/game/session';
import { tap } from '@/fx/haptics';
import { AtlasSilhouette } from '@/map/AtlasSilhouette';
import { recordKey, selectDailyDone, useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button, type ButtonTone } from '@/ui/Button';
import { IconAtlas, IconCap, IconHourglass, IconSeal } from '@/ui/icons';
import { Text } from '@/ui/Text';
import type { IconProps } from '@/ui/icons';

const ATLAS_NAME: Record<AtlasId, string> = {
  'france-departments': 'France',
  'world-countries': 'Monde',
};

type Mode = 'revision' | 'discovery' | 'expedition' | 'daily';

export default function Embarquer() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const settings = useProgress((s) => s.settings);
  const cards = useProgress((s) => s.cards);
  const records = useProgress((s) => s.records);
  const updateSettings = useProgress((s) => s.updateSettings);
  const prepare = useSession((s) => s.prepare);

  const atlasId = settings.lastAtlas;
  const todayKey = dailyKey();
  const dailyDone = useProgress((s) => selectDailyDone(s, todayKey));

  const rungIndex = useMemo(
    () => currentRung(atlasId, cards, settings.floor),
    [atlasId, cards, settings.floor],
  );
  const fresh = useMemo(() => undiscovered(atlasId, cards, rungIndex), [atlasId, cards, rungIndex]);
  const due = useMemo(() => dueCount(cards, atlasId, Date.now()), [cards, atlasId]);

  const [mode, setMode] = useState<Mode>(
    due > 0 ? 'revision' : fresh.length > 0 ? 'discovery' : 'expedition',
  );

  const best = records.best[recordKey(atlasId, 'expedition')] ?? 0;

  const launch = () => {
    if (mode === 'discovery') {
      router.replace('/decouverte');
      return;
    }
    if (mode === 'revision') {
      const queue = dueQueue(cards, atlasId, Date.now(), REVISION_BATCH);
      prepare(
        lessonConfig(
          atlasId,
          seedFrom(`revision:${atlasId}:${queue[0]?.cardId ?? ''}`),
          rungIndex,
          queue.map((d) => d.cardId),
        ),
      );
    } else if (mode === 'daily') {
      prepare(dailyConfig(atlasId, seedFrom(`daily:${todayKey}:${atlasId}`)));
    } else {
      prepare(expeditionConfig(atlasId, seedFrom(`${atlasId}:${Date.now()}`), rungIndex));
    }
    router.replace('/play');
  };

  const tone: ButtonTone =
    mode === 'expedition' ? 'danger' : mode === 'daily' ? 'reward' : 'success';

  const tileWidth = (width - theme.space.xl * 2 - theme.space.sm) / 2;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: theme.space.xl,
          minHeight: theme.hitTarget.min,
        }}
      >
        <Pressable
          onPress={() => {
            tap();
            router.back();
          }}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        >
          <Text variant="title" color="textTertiary">
            ✕
          </Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: theme.space.xl, justifyContent: 'center' }}>
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{ flexDirection: 'row', gap: theme.space.sm }}
        >
          {(Object.keys(ATLASES) as AtlasId[]).map((id) => (
            <TerrainTile
              key={id}
              atlasId={id}
              width={tileWidth}
              selected={id === atlasId}
              onPress={() => {
                tap();
                updateSettings({ lastAtlas: id });
              }}
            />
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).duration(300)}
          style={{ gap: theme.space.xs, marginTop: theme.space.xl }}
        >
          <ModeRow
            icon={IconCap}
            title="Révision"
            metric={due > 0 ? `${due}` : '—'}
            accent={theme.colors.success}
            selected={mode === 'revision'}
            disabled={due === 0}
            onPress={() => {
              tap();
              setMode('revision');
            }}
          />
          <ModeRow
            icon={IconAtlas}
            title="Découverte"
            metric={fresh.length > 0 ? `${Math.min(5, fresh.length)}` : '—'}
            accent={theme.colors.success}
            selected={mode === 'discovery'}
            disabled={fresh.length === 0}
            onPress={() => {
              tap();
              setMode('discovery');
            }}
          />
          <ModeRow
            icon={IconHourglass}
            title="Expédition"
            metric={best > 0 ? `${best}` : '—'}
            accent={theme.colors.danger}
            selected={mode === 'expedition'}
            onPress={() => {
              tap();
              setMode('expedition');
            }}
          />
          <ModeRow
            icon={IconSeal}
            title="Relevé du jour"
            metric={dailyDone ? '✓' : '10'}
            accent={theme.colors.reward}
            selected={mode === 'daily'}
            disabled={dailyDone}
            onPress={() => {
              tap();
              setMode('daily');
            }}
          />
        </Animated.View>
      </View>

      <View
        style={{
          paddingHorizontal: theme.space.xl,
          paddingBottom: insets.bottom + theme.space.lg,
        }}
      >
        <Button label="Commencer" size="lg" tone={tone} block onPress={launch} />
      </View>
    </View>
  );
}

function TerrainTile({
  atlasId,
  width,
  selected,
  onPress,
}: {
  atlasId: AtlasId;
  width: number;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        width,
        height: 132,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: theme.space.md,
        backgroundColor: selected ? theme.colors.surfaceRaised : theme.colors.surface,
        borderWidth: selected ? theme.borderWidth.thick : theme.borderWidth.hair,
        borderColor: selected ? theme.colors.borderStrong : theme.colors.border,
      }}
    >
      <View
        style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 42 }}
        pointerEvents="none"
      >
        <AtlasSilhouette atlas={ATLASES[atlasId]} opacity={selected ? 0.32 : 0.14} />
      </View>
      <Text variant="label" color={selected ? 'text' : 'textTertiary'}>
        {ATLAS_NAME[atlasId]}
      </Text>
    </Pressable>
  );
}

function ModeRow({
  icon: Icon,
  title,
  metric,
  accent,
  selected,
  disabled = false,
  onPress,
}: {
  icon: (props: IconProps) => React.ReactElement;
  title: string;
  metric: string;
  accent: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        minHeight: theme.hitTarget.comfortable,
        paddingHorizontal: theme.space.lg,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.surfaceRaised : 'transparent',
        borderWidth: theme.borderWidth.thin,
        borderColor: selected ? accent : 'transparent',
        opacity: disabled ? theme.opacity.disabled : 1,
      }}
    >
      <Icon size={20} color={selected ? accent : theme.colors.textTertiary} active={selected} />
      <Text variant="label" color={selected ? 'text' : 'textSecondary'} style={{ flex: 1 }}>
        {title}
      </Text>
      <Text variant="numeralSm" color={selected ? accent : 'textTertiary'} tabular>
        {metric}
      </Text>
    </Pressable>
  );
}
