import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import { brevetStandings, type BrevetStanding, type BrevetTier } from '@/game/brevets';
import { rankProgress } from '@/game/economy';
import { cartouchesOf, masteryOf, type Cartouche } from '@/game/mastery';
import { dailyKey } from '@/game/rng';
import { isComplete, type Quest } from '@/game/quests';
import { tap } from '@/fx/haptics';
import { questsOf, useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { IconBrevet, IconChevron, IconDoublon, IconSeal } from '@/ui/icons';
import { ListRow, ListSection } from '@/ui/List';
import { usePressResponse } from '@/ui/motion';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const COLUMNS = 4;

export default function Brevets() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const cards = useProgress((s) => s.cards);
  const purse = useProgress((s) => s.purse);
  const settings = useProgress((s) => s.settings);
  const daily = useProgress((s) => s.daily);
  const records = useProgress((s) => s.records);
  const owned = useProgress((s) => s.brevets);
  const carnet = useProgress((s) => s.carnet);

  const [picked, setPicked] = useState<BrevetStanding | null>(null);

  const todayKey = dailyKey();
  const quests = useMemo(() => questsOf(carnet, todayKey), [carnet, todayKey]);
  const rank = rankProgress(purse.xp);

  const standings = useMemo(
    () =>
      brevetStandings({
        cards,
        xp: purse.xp,
        longestStreak: daily.longestStreak,
        floor: Math.max(...Object.values(settings.floors)),
        bestCombo: records.bestCombo,
      }).map((s) => ({ ...s, earned: s.earned || owned[s.id] !== undefined })),
    [cards, purse.xp, daily.longestStreak, settings.floors, records.bestCombo, owned],
  );

  const held = standings.filter((s) => s.earned);
  const next = standings.find((s) => !s.earned && s.ratio > 0) ?? standings.find((s) => !s.earned);

  const sealed = useMemo(() => {
    const out: Cartouche[] = [];
    for (const atlasId of Object.keys(ATLASES) as AtlasId[]) {
      out.push(
        ...cartouchesOf(masteryOf(cards, atlasId), atlasId, ATLASES[atlasId]).filter(
          (c) => c.sealed,
        ),
      );
    }
    return out;
  }, [cards]);

  const cell = (width - theme.space.lg * 2 - theme.space.md * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.space.lg,
          minHeight: theme.hitTarget.comfortable,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="cartouche" color="textTertiary">
            {rank.current.name}
          </Text>
          <Text variant="title">
            {held.length} brevet{held.length > 1 ? 's' : ''} sur {standings.length}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            tap();
            router.push('/comptoir');
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le Comptoir"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.xs,
            minHeight: theme.hitTarget.min,
            paddingLeft: theme.space.md,
          }}
        >
          <IconDoublon size={16} color={theme.colors.reward} active />
          <Text variant="numeralSm" tabular>
            {purse.doublons}
          </Text>
          <IconChevron size={16} color={theme.colors.textTertiary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ListSection title="Aujourd’hui" style={{ marginTop: theme.space.md }}>
          {quests.map((quest, i) => (
            <QuestRow key={quest.id} quest={quest} first={i === 0} />
          ))}
        </ListSection>

        {next ? (
          <ListSection title="Le prochain" style={{ marginTop: theme.space.xl }}>
            <ListRow
              first
              title={next.name}
              detail={next.detail}
              meta={`${next.have} / ${next.need}`}
              chevron
              onPress={() => setPicked(next)}
              leading={<Medal tier={next.tier} size={34} ratio={next.ratio} earned={false} />}
            />
          </ListSection>
        ) : null}

        <ListSection title="Titres" style={{ marginTop: theme.space.xl }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.space.md,
              paddingHorizontal: theme.space.lg,
              paddingTop: theme.space.xs,
            }}
          >
            {standings.map((standing) => (
              <Medallion
                key={standing.id}
                standing={standing}
                size={cell}
                onPress={() => {
                  tap();
                  setPicked(standing);
                }}
              />
            ))}
          </View>
        </ListSection>

        {sealed.length > 0 ? (
          <ListSection title="Cartouches scellés" style={{ marginTop: theme.space.xl }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.space.xs,
                paddingHorizontal: theme.space.lg,
              }}
            >
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
          </ListSection>
        ) : null}
      </ScrollView>

      <Sheet
        visible={Boolean(picked)}
        onClose={() => setPicked(null)}
        eyebrow={picked ? TIER_LABEL[picked.tier] : undefined}
        title={picked?.name}
      >
        {picked ? (
          <View
            style={{
              paddingHorizontal: theme.space.xl,
              paddingTop: theme.space.md,
              gap: theme.space.md,
            }}
          >
            <Text variant="body" color="textSecondary">
              {picked.detail}
            </Text>

            {picked.earned ? (
              <Text variant="label" color="success">
                Obtenu
              </Text>
            ) : (
              <View style={{ gap: theme.space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text variant="numeral" tabular style={{ flex: 1 }}>
                    {picked.have} / {picked.need}
                  </Text>
                  <Text variant="labelSm" color="textTertiary">
                    +{picked.reward} doublons
                  </Text>
                </View>
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: theme.colors.surfaceSunk,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.max(picked.ratio * 100, picked.ratio > 0 ? 3 : 0)}%`,
                      height: '100%',
                      backgroundColor: theme.colors.reward,
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const TIER_LABEL: Record<BrevetTier, string> = {
  cuivre: 'Cuivre',
  argent: 'Argent',
  or: 'Or',
};

const TIER_COLOR: Record<BrevetTier, 'danger' | 'info' | 'reward'> = {
  cuivre: 'danger',
  argent: 'info',
  or: 'reward',
};

function QuestRow({ quest, first }: { quest: Quest; first: boolean }) {
  const theme = useTheme();
  const done = isComplete(quest);
  const ratio = quest.target === 0 ? 1 : Math.min(1, quest.progress / quest.target);

  return (
    <ListRow
      first={first}
      title={quest.label}
      meta={`${Math.min(quest.progress, quest.target)}/${quest.target}`}
      leading={
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: done ? theme.colors.success : theme.colors.surfaceSunk,
            borderWidth: theme.borderWidth.hair,
            borderColor: done ? theme.colors.success : theme.colors.borderStrong,
            opacity: done ? 1 : 0.4 + ratio * 0.6,
          }}
        />
      }
    />
  );
}

/**
 * Three readable states rather than two: a locked brevet still shows the arc of
 * what has been done, so a fresh account is not a page of grey discs.
 */
function Medal({
  tier,
  size,
  ratio,
  earned,
}: {
  tier: BrevetTier;
  size: number;
  ratio: number;
  earned: boolean;
}) {
  const theme = useTheme();
  const accent = theme.colors[TIER_COLOR[tier]];
  const started = !earned && ratio > 0;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: earned ? accent : theme.colors.surface,
        borderWidth: earned ? 0 : started ? theme.borderWidth.thick : theme.borderWidth.thin,
        borderColor: started ? accent : theme.colors.border,
      }}
    >
      {started ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${ratio * 100}%`,
            backgroundColor: accent,
            opacity: 0.22,
          }}
        />
      ) : null}
      <IconBrevet
        size={size * 0.48}
        active={earned}
        color={earned ? theme.colors.textOnAccent : started ? accent : theme.colors.textTertiary}
      />
    </View>
  );
}

function Medallion({
  standing,
  size,
  onPress,
}: {
  standing: BrevetStanding;
  size: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressResponse(0.06);

  return (
    <Animated.View style={[{ width: size }, press.style]}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${standing.name}. ${standing.detail} ${
          standing.earned ? 'Obtenu.' : `${standing.have} sur ${standing.need}.`
        }`}
        style={{ alignItems: 'center', gap: theme.space.xs }}
      >
        <Medal tier={standing.tier} size={size} ratio={standing.ratio} earned={standing.earned} />
        <Text
          variant="caption"
          color={standing.earned ? 'textSecondary' : 'textTertiary'}
          align="center"
          numberOfLines={2}
        >
          {standing.name}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
