import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import { dailyKey, seedFrom } from '@/game/rng';
import { dailyConfig, expeditionConfig } from '@/game/session';
import { tap } from '@/fx/haptics';
import { recordKey, selectDailyDone, useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { CompassRose } from '@/ui/brand/CompassRose';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

const ATLAS_LABEL: Record<AtlasId, { name: string; detail: string }> = {
  'france-departments': { name: 'France', detail: '101 départements et leurs chefs-lieux' },
  'world-countries': { name: 'Monde', detail: '193 États membres de l’ONU' },
};

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const settings = useProgress((s) => s.settings);
  const records = useProgress((s) => s.records);
  const daily = useProgress((s) => s.daily);
  const cards = useProgress((s) => s.cards);
  const updateSettings = useProgress((s) => s.updateSettings);
  const startSession = useSession((s) => s.start);

  const atlasId = settings.lastAtlas;
  const todayKey = dailyKey();
  const dailyDone = useProgress((s) => selectDailyDone(s, todayKey));

  /* Cartes acquises pour l'atlas courant, tous angles de question confondus. */
  const mastery = useMemo(() => {
    const prefix = `${atlasId}:`;
    let known = 0;
    let total = 0;
    for (const [id, card] of Object.entries(cards)) {
      if (!id.startsWith(prefix)) continue;
      total++;
      if (card.level >= 3) known++;
    }
    return { known, total };
  }, [cards, atlasId]);

  const best = records.best[recordKey(atlasId, 'expedition')] ?? 0;

  const beginExpedition = () => {
    startSession(expeditionConfig(atlasId, seedFrom(`${atlasId}:${Date.now()}`)));
    router.push('/play');
  };

  const beginDaily = () => {
    startSession(dailyConfig(atlasId, seedFrom(`daily:${todayKey}:${atlasId}`)));
    router.push('/play');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{
        paddingTop: insets.top + theme.space.xl,
        paddingBottom: insets.bottom + theme.space.xxl,
        paddingHorizontal: theme.space.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Rose en filigrane : la marque habite le fond, sans jamais disputer la
          lisibilité au contenu. */}
      <View style={styles.watermark} pointerEvents="none">
        <CompassRose size={width * 1.15} points={16} dial opacity={0.07} />
      </View>

      <View style={{ marginBottom: theme.space.xl }}>
        <Text variant="cartouche" color="textTertiary">
          Atlas de poche
        </Text>
        <Text variant="displayXL" style={{ marginTop: theme.space.xs }}>
          Portulan
        </Text>
        <Text variant="note" color="textSecondary" style={{ marginTop: theme.space.xs }}>
          Apprendre la géographie à la main levée.
        </Text>
      </View>

      <StreakBanner streak={daily.currentStreak} longest={daily.longestStreak} />

      <Text variant="cartouche" color="textTertiary" style={{ marginTop: theme.space.xl }}>
        Terrain
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.space.sm, marginTop: theme.space.sm }}>
        {(Object.keys(ATLASES) as AtlasId[]).map((id) => (
          <AtlasChip
            key={id}
            label={ATLAS_LABEL[id].name}
            selected={id === atlasId}
            onPress={() => {
              tap();
              updateSettings({ lastAtlas: id });
            }}
          />
        ))}
      </View>
      <Text variant="caption" color="textTertiary" style={{ marginTop: theme.space.sm }}>
        {ATLAS_LABEL[atlasId].detail}
      </Text>

      <View style={{ gap: theme.space.md, marginTop: theme.space.xl }}>
        <ModeCard
          eyebrow="Sans fin"
          title="Expédition"
          body="La réserve de temps s’épuise. Chaque bonne réponse la recharge — les mauvaises l’assèchent."
          metric={best > 0 ? `${best}` : '—'}
          metricLabel="record"
          accent={theme.colors.danger}
          onPress={beginExpedition}
        />
        <ModeCard
          eyebrow={dailyDone ? 'Terminé aujourd’hui' : 'Une fois par jour'}
          title="Relevé du jour"
          body="Dix questions, les mêmes pour tout le monde. Revenez demain pour tenir la série."
          metric={`${daily.currentStreak}`}
          metricLabel="jours d’affilée"
          accent={theme.colors.reward}
          onPress={beginDaily}
          muted={dailyDone}
        />
        <ModeCard
          eyebrow="Progression"
          title="Atlas"
          body="Votre carte se colore à mesure que les territoires entrent en mémoire longue."
          metric={`${mastery.known}`}
          metricLabel={mastery.total > 0 ? `sur ${mastery.total} vus` : 'à découvrir'}
          accent={theme.colors.success}
          onPress={() => router.push('/atlas')}
        />
      </View>
    </ScrollView>
  );
}

function StreakBanner({ streak, longest }: { streak: number; longest: number }) {
  const theme = useTheme();
  if (streak === 0 && longest === 0) return null;

  return (
    <PaperSurface
      tone="raised"
      bordered
      radius="md"
      grain={0.35}
      elevation="sheet"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.space.md,
        gap: theme.space.md,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.rewardSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="numeral" color="reward" tabular>
          {streak}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label">
          {streak > 0 ? 'Série en cours' : 'Série interrompue'}
        </Text>
        <Text variant="caption" color="textSecondary">
          {longest > 0 ? `Meilleure série : ${longest} jours` : 'Relevez le défi du jour'}
        </Text>
      </View>
    </PaperSurface>
  );
}

function AtlasChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        minHeight: theme.hitTarget.min,
        paddingVertical: theme.space.sm,
        paddingHorizontal: theme.space.md,
        borderRadius: theme.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? theme.colors.text : theme.colors.surface,
        borderWidth: theme.borderWidth.thin,
        borderColor: selected ? theme.colors.text : theme.colors.border,
      }}
    >
      <Text variant="label" color={selected ? 'textInverse' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function ModeCard({
  eyebrow,
  title,
  body,
  metric,
  metricLabel,
  accent,
  onPress,
  muted = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  metric: string;
  metricLabel: string;
  accent: string;
  onPress: () => void;
  muted?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <PaperSurface
        tone="raised"
        bordered
        radius="lg"
        grain={0.4}
        elevation="lifted"
        style={{ padding: theme.space.lg, opacity: muted ? 0.7 : 1, overflow: 'hidden' }}
      >
        {/* Filet de couleur en bord gauche : chaque mode a sa teinte, ce qui
            permet de les reconnaître avant même d'avoir lu le titre. */}
        <View
          style={[styles.accentRule, { backgroundColor: accent }]}
          pointerEvents="none"
        />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.lg }}>
          <View style={{ flex: 1 }}>
            <Text variant="cartouche" color="textTertiary">
              {eyebrow}
            </Text>
            <Text variant="titleLg" style={{ marginTop: theme.space.xs }}>
              {title}
            </Text>
            <Text
              variant="bodySm"
              color="textSecondary"
              style={{ marginTop: theme.space.sm }}
            >
              {body}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 72 }}>
            <Text variant="numeral" color={accent} tabular>
              {metric}
            </Text>
            <Text variant="caption" color="textTertiary" align="right">
              {metricLabel}
            </Text>
          </View>
        </View>
      </PaperSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  watermark: {
    position: 'absolute',
    top: -40,
    right: -120,
    opacity: 1,
  },
  accentRule: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
});
