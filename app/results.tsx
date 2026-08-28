import { useEffect, useMemo, useRef } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brevetById } from '@/game/brevets';
import { rankFor } from '@/game/economy';
import { seedFrom, dailyKey } from '@/game/rng';
import { emojiSummary, expeditionConfig, dailyConfig } from '@/game/session';
import { recordKey, useProgress, type SessionReport } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { CompassRose } from '@/ui/brand/CompassRose';
import { IconBrevet, IconDoublon } from '@/ui/icons';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

export default function Results() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const session = useSession((s) => s.session);
  const summary = useSession((s) => s.summary);
  const prepare = useSession((s) => s.prepare);
  const completeDaily = useProgress((s) => s.completeDaily);
  const best = useProgress((s) => s.records.best);
  const streak = useProgress((s) => s.daily.currentStreak);
  const report = useSession((s) => s.report);

  const todayKey = dailyKey();
  const savedDaily = useRef(false);

  useEffect(() => {
    if (!session || !summary || savedDaily.current) return;
    if (session.config.mode !== 'daily') return;
    savedDaily.current = true;
    completeDaily({
      dateKey: todayKey,
      score: summary.score,
      correct: summary.correct,
      asked: summary.asked,
      atlasId: session.config.atlasId,
    });
  }, [session, summary, completeDaily, todayKey]);

  const isRecord = useMemo(() => {
    if (!session || !summary) return false;
    const key = recordKey(session.config.atlasId, session.config.mode);
    return summary.asked > 0 && (best[key] ?? 0) === summary.score && summary.score > 0;
  }, [session, summary, best]);

  if (!session || !summary) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.canvas }]}>
        <Text variant="note" color="textSecondary">
          Aucun relevé à afficher.
        </Text>
        <Button
          label="Retour à l’accueil"
          variant="secondary"
          onPress={() => router.replace('/')}
          style={{ marginTop: theme.space.lg }}
        />
      </View>
    );
  }

  const isDaily = session.config.mode === 'daily';
  const accuracy = Math.round(summary.accuracy * 100);

  const replay = () => {
    prepare(
      isDaily
        ? dailyConfig(session.config.atlasId, seedFrom(`daily:${todayKey}:${session.config.atlasId}`))
        : expeditionConfig(
            session.config.atlasId,
            seedFrom(`${session.config.atlasId}:${Date.now()}`),
            session.config.rung,
          ),
    );
    router.replace('/play');
  };

  const share = () => {
    void Share.share({ message: emojiSummary(session, todayKey) });
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.canvas,
        paddingTop: insets.top + theme.space.xl,
        paddingBottom: insets.bottom + theme.space.lg,
        paddingHorizontal: theme.space.lg,
      }}
    >
      <View style={styles.watermark} pointerEvents="none">
        <CompassRose size={340} points={16} dial opacity={0.06} />
      </View>

      <Animated.View entering={FadeInDown.duration(420)}>
        <Text variant="cartouche" color="textTertiary">
          {isDaily ? `Relevé du ${todayKey}` : 'Fin d’expédition'}
        </Text>
        <ScoreDial score={summary.score} record={isRecord} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(420)}>
        <PaperSurface
          tone="raised"
          bordered
          radius="lg"
          grain={0.35}
          elevation="sheet"
          style={{ padding: theme.space.lg, marginTop: theme.space.xl }}
        >
          <View style={styles.statRow}>
            <Stat label="Justes" value={`${summary.correct}/${summary.asked}`} />
            <Stat label="Précision" value={`${accuracy} %`} />
            <Stat label="Meilleure série" value={`${summary.bestCombo}`} />
          </View>
          <View style={[styles.statRow, { marginTop: theme.space.lg }]}>
            <Stat
              label="Temps médian"
              value={`${(summary.medianElapsed / 1000).toFixed(1)} s`}
            />
            <Stat label="Durée" value={formatDuration(summary.duration)} />
            {isDaily ? <Stat label="Série" value={`${streak} j`} /> : <View style={{ flex: 1 }} />}
          </View>
        </PaperSurface>
      </Animated.View>

      {isDaily ? (
        <Animated.View entering={FadeInDown.delay(220).duration(420)}>
          <PaperSurface
            tone="sunk"
            radius="md"
            grain={0.2}
            style={{ padding: theme.space.lg, marginTop: theme.space.md, alignItems: 'center' }}
          >
            <Text variant="title" style={{ letterSpacing: 4 }}>
              {session.answers.map((a) => (a.correct ? '🟩' : '🟥')).join('')}
            </Text>
          </PaperSurface>
        </Animated.View>
      ) : null}

      {report ? (
        <Animated.View entering={FadeInDown.delay(280).duration(420)}>
          <Ledger report={report} />
        </Animated.View>
      ) : null}

      <View style={{ flex: 1 }} />

      <View style={{ gap: theme.space.sm }}>
        {isDaily ? (
          <Button label="Partager le relevé" block onPress={share} />
        ) : (
          <Button label="Repartir" block onPress={replay} />
        )}
        <Button
          label="Revenir au port"
          variant="secondary"
          block
          onPress={() => router.replace('/')}
        />
      </View>
    </View>
  );
}

function ScoreDial({ score, record }: { score: number; record: boolean }) {
  const theme = useTheme();
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, theme.motion.spring.needle);
  }, [scale, theme.motion.spring.needle]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ alignItems: 'flex-start' }, style]}>
      <Text variant="numeralXL" tabular>
        {score}
      </Text>
      {record ? (
        <View
          style={{
            marginTop: theme.space.xs,
            paddingHorizontal: theme.space.md,
            paddingVertical: theme.space.xs,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.rewardSoft,
            borderWidth: theme.borderWidth.hair,
            borderColor: theme.colors.reward,
          }}
        >
          <Text variant="cartouche" color="rewardStrong">
            Nouveau record
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function Ledger({ report }: { report: SessionReport }) {
  const theme = useTheme();

  const rankBefore = rankFor(report.xpBefore);
  const rankAfter = rankFor(report.xpAfter);
  const promoted = rankAfter.index > rankBefore.index;

  const total =
    report.earnings.doublons + report.brevetDoublons + report.carnet.doublons;
  if (total === 0 && report.earnings.xp === 0) return null;

  return (
    <PaperSurface
      tone="raised"
      bordered
      radius="lg"
      grain={0.3}
      elevation="sheet"
      style={{ padding: theme.space.lg, marginTop: theme.space.md }}
    >
      {report.earnings.lines.map((line) => (
        <View
          key={line.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            paddingVertical: 3,
          }}
        >
          <Text variant="bodySm" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
            {line.label}
          </Text>
          {line.xp > 0 ? (
            <Text variant="numeralSm" color="info" tabular>
              +{line.xp} xp
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 62, justifyContent: 'flex-end' }}>
            <IconDoublon size={13} color={theme.colors.reward} active />
            <Text variant="numeralSm" tabular>
              +{line.doublons}
            </Text>
          </View>
        </View>
      ))}

      {report.carnet.doublons > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            paddingVertical: 3,
          }}
        >
          <Text variant="bodySm" color="success" style={{ flex: 1 }}>
            Carnet de bord — {report.carnet.completed} objectif
            {report.carnet.completed > 1 ? 's' : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconDoublon size={13} color={theme.colors.reward} active />
            <Text variant="numeralSm" tabular>
              +{report.carnet.doublons}
            </Text>
          </View>
        </View>
      ) : null}

      {promoted ? (
        <View
          style={{
            marginTop: theme.space.md,
            padding: theme.space.md,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.infoSoft,
            borderWidth: theme.borderWidth.hair,
            borderColor: theme.colors.info,
          }}
        >
          <Text variant="cartouche" color="info">
            Promotion
          </Text>
          <Text variant="title" style={{ marginTop: theme.space.xxs }}>
            {rankAfter.name}
          </Text>
        </View>
      ) : null}

      {report.brevets.length > 0 ? (
        <View style={{ marginTop: theme.space.md, gap: theme.space.sm }}>
          {report.brevets.map((id) => {
            const brevet = brevetById(id);
            if (!brevet) return null;
            return (
              <View
                key={id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.md,
                  padding: theme.space.md,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.rewardSoft,
                  borderWidth: theme.borderWidth.hair,
                  borderColor: theme.colors.reward,
                }}
              >
                <IconBrevet size={20} color={theme.colors.rewardStrong} active />
                <View style={{ flex: 1 }}>
                  <Text variant="cartouche" color="rewardStrong">
                    Brevet
                  </Text>
                  <Text variant="label">{brevet.name}</Text>
                </View>
                <Text variant="numeralSm" color="rewardStrong" tabular>
                  +{brevet.reward}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </PaperSurface>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="title" tabular>
        {value}
      </Text>
      <Text variant="caption" color="textTertiary">
        {label}
      </Text>
    </View>
  );
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes} min ${String(seconds).padStart(2, '0')}` : `${seconds} s`;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  statRow: { flexDirection: 'row', gap: 12 },
  watermark: { position: 'absolute', top: 60, right: -110 },
});
