import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ATLASES, type AtlasId } from '@/data';
import { BREVETS, earnedBrevets, TIER_ORDER, type Brevet, type BrevetTier } from '@/game/brevets';
import { rankProgress } from '@/game/economy';
import { cartouchesOf, masteryOf, type Cartouche } from '@/game/mastery';
import { dailyKey } from '@/game/rng';
import { isComplete, type Quest } from '@/game/quests';
import { tap } from '@/fx/haptics';
import { questsOf, useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Hud, type HudChip } from '@/ui/Hud';
import { IconBrevet, IconDoublon, IconSeal } from '@/ui/icons';
import { Text } from '@/ui/Text';

const COLUMNS = 4;

export default function Brevets() {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const cards = useProgress((s) => s.cards);
  const purse = useProgress((s) => s.purse);
  const settings = useProgress((s) => s.settings);
  const daily = useProgress((s) => s.daily);
  const records = useProgress((s) => s.records);
  const owned = useProgress((s) => s.brevets);
  const carnet = useProgress((s) => s.carnet);
  const todayKey = dailyKey();
  const quests = useMemo(() => questsOf(carnet, todayKey), [carnet, todayKey]);

  const rank = rankProgress(purse.xp);

  const merited = useMemo(
    () =>
      new Set(
        earnedBrevets({
          cards,
          xp: purse.xp,
          longestStreak: daily.longestStreak,
          bestExpedition: 0,
          floor: settings.floor,
          bestCombo: records.bestCombo,
        }),
      ),
    [cards, purse.xp, daily.longestStreak, settings.floor, records.bestCombo],
  );

  const sealed = useMemo(() => {
    const out: Cartouche[] = [];
    for (const atlasId of Object.keys(ATLASES) as AtlasId[]) {
      const atlas = ATLASES[atlasId];
      out.push(
        ...cartouchesOf(masteryOf(cards, atlasId, atlas), atlasId, atlas).filter((c) => c.sealed),
      );
    }
    return out;
  }, [cards]);

  const held = BREVETS.filter((b) => merited.has(b.id) || owned[b.id] !== undefined);

  const chips: HudChip[] = [
    { key: 'doublons', value: `${purse.doublons}`, tone: 'reward', icon: IconDoublon },
    { key: 'brevets', value: `${held.length}/${BREVETS.length}`, tone: 'text', icon: IconBrevet },
    { key: 'seals', value: `${sealed.length}`, tone: 'success', icon: IconSeal },
  ];

  const cell = (width - theme.space.xl * 2 - theme.space.md * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <Hud
        chips={chips}
        trailing={
          <Pressable
            onPress={() => {
              tap();
              router.push('/comptoir');
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Comptoir"
          >
            <Text variant="labelSm" color="info" style={{ marginLeft: theme.space.md }}>
              Comptoir
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.xl,
          paddingBottom: theme.space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{ alignItems: 'center', paddingVertical: theme.space.xl }}
        >
          <Text variant="display">{rank.current.name}</Text>
          <View
            style={{
              width: 180,
              height: 6,
              borderRadius: 3,
              marginTop: theme.space.md,
              backgroundColor: theme.colors.surfaceSunk,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(rank.ratio * 100, rank.ratio > 0 ? 4 : 0)}%`,
                height: '100%',
                backgroundColor: theme.colors.info,
              }}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <Label text="Aujourd’hui" />
          {quests.map((quest) => (
            <QuestRow key={quest.id} quest={quest} />
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).duration(300)}
          style={{ marginTop: theme.space.xl }}
        >
          <Label text="Titres" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md }}>
            {[...BREVETS]
              .sort(
                (a, b) =>
                  Number(merited.has(b.id)) - Number(merited.has(a.id)) ||
                  TIER_ORDER[a.tier] - TIER_ORDER[b.tier],
              )
              .map((brevet) => (
                <Medallion
                  key={brevet.id}
                  brevet={brevet}
                  size={cell}
                  earned={merited.has(brevet.id) || owned[brevet.id] !== undefined}
                />
              ))}
          </View>
        </Animated.View>

        {sealed.length > 0 ? (
          <Animated.View
            entering={FadeInDown.delay(180).duration(300)}
            style={{ marginTop: theme.space.xl }}
          >
            <Label text="Cartouches" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
              {sealed.map((cartouche) => (
                <View
                  key={cartouche.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: theme.space.md,
                    paddingVertical: theme.space.sm,
                    borderRadius: theme.radius.pill,
                    backgroundColor: theme.colors.rewardSoft,
                    borderWidth: theme.borderWidth.hair,
                    borderColor: theme.colors.reward,
                  }}
                >
                  <IconSeal size={13} color={theme.colors.rewardStrong} active />
                  <Text variant="caption" color="rewardStrong">
                    {cartouche.name}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Label({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Text variant="cartouche" color="textTertiary" style={{ marginBottom: theme.space.md }}>
      {text}
    </Text>
  );
}

function QuestRow({ quest }: { quest: Quest }) {
  const theme = useTheme();
  const done = isComplete(quest);
  const ratio = quest.target === 0 ? 1 : Math.min(1, quest.progress / quest.target);

  return (
    <View style={{ paddingVertical: theme.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: done ? theme.colors.success : theme.colors.borderStrong,
          }}
        />
        <Text
          variant="bodySm"
          color={done ? 'textTertiary' : 'text'}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {quest.label}
        </Text>
        <Text variant="numeralSm" color={done ? 'success' : 'textTertiary'} tabular>
          {Math.min(quest.progress, quest.target)}/{quest.target}
        </Text>
      </View>

      <View
        style={{
          height: 3,
          borderRadius: 2,
          marginTop: theme.space.xs,
          marginLeft: theme.space.lg,
          backgroundColor: theme.colors.surfaceSunk,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(ratio * 100, ratio > 0 ? 3 : 0)}%`,
            height: '100%',
            backgroundColor: done ? theme.colors.success : theme.colors.reward,
          }}
        />
      </View>
    </View>
  );
}

const TIER_COLOR: Record<BrevetTier, 'danger' | 'info' | 'reward'> = {
  cuivre: 'danger',
  argent: 'info',
  or: 'reward',
};

function Medallion({ brevet, size, earned }: { brevet: Brevet; size: number; earned: boolean }) {
  const theme = useTheme();
  const accent = theme.colors[TIER_COLOR[brevet.tier]];

  return (
    <Pressable
      onPress={() => {
        tap();
        Alert.alert(brevet.name, brevet.detail);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${brevet.name}. ${brevet.detail}`}
      accessibilityState={{ disabled: !earned }}
      style={{ width: size, alignItems: 'center', gap: theme.space.xs }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: earned ? accent : theme.colors.surface,
          borderWidth: earned ? 0 : theme.borderWidth.thin,
          borderColor: theme.colors.borderSoft,
          opacity: earned ? 1 : 0.55,
        }}
      >
        <IconBrevet
          size={size * 0.5}
          active={earned}
          color={earned ? theme.colors.textOnAccent : theme.colors.textTertiary}
        />
      </View>
      <Text
        variant="caption"
        color={earned ? 'textSecondary' : 'textQuiet'}
        align="center"
        numberOfLines={2}
      >
        {brevet.name}
      </Text>
    </Pressable>
  );
}
