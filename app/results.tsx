import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brevetById } from '@/game/brevets';
import { rankFor } from '@/game/economy';
import { recommended } from '@/game/plan';
import { dailyKey } from '@/game/rng';
import { emojiSummary } from '@/game/session';
import {
  recordKey,
  selectDailyDone,
  selectStudying,
  useProgress,
  type SessionReport,
} from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { useLaunch } from '@/ui/game/useLaunch';
import { IconBrevet, IconChevron, IconDoublon } from '@/ui/icons';
import { ListRow, ListSection } from '@/ui/List';
import { useEmphasis } from '@/ui/motion';
import { PaperSurface } from '@/ui/PaperSurface';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { useNow } from '@/ui/useNow';

export default function Results() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const session = useSession((s) => s.session);
  const summary = useSession((s) => s.summary);
  const report = useSession((s) => s.report);
  const clear = useSession((s) => s.clear);

  const completeDaily = useProgress((s) => s.completeDaily);
  const best = useProgress((s) => s.records.best);
  const streak = useProgress((s) => s.daily.currentStreak);
  const cards = useProgress((s) => s.cards);
  const floors = useProgress((s) => s.settings.floors);
  const studying = useProgress(selectStudying);
  const dailyDone = useProgress((s) => selectDailyDone(s, dailyKey()));

  const launch = useLaunch();
  const now = useNow();
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

  const next = useMemo(
    () =>
      recommended(
        studying.map((id) => ({
          atlasId: id,
          cards,
          floor: floors[id] ?? 0,
          dailyDone,
          now,
        })),
      ),
    [studying, cards, floors, dailyDone, now],
  );

  const port = () => {
    router.replace('/');
    clear();
  };

  if (!session || !summary) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.canvas }]}>
        <Text variant="note" color="textSecondary">
          Aucun relevé à afficher.
        </Text>
        <Button
          label="Revenir au port"
          variant="secondary"
          onPress={port}
          style={{ marginTop: theme.space.lg }}
        />
      </View>
    );
  }

  const isDaily = session.config.mode === 'daily';
  const accuracy = Math.round(summary.accuracy * 100);

  const verdict =
    summary.asked === 0
      ? 'Partie sans réponse'
      : accuracy >= 90
        ? 'Relevé net'
        : accuracy >= 70
          ? 'Bonne tenue'
          : accuracy >= 50
            ? 'Cap à redresser'
            : 'Il y a du travail';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <ScreenHeader
        leading="none"
        eyebrow={isDaily ? `Relevé du ${todayKey}` : 'Fin de partie'}
        title={verdict}
      />

      <Animated.ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: theme.space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScoreDial score={summary.score} record={isRecord} />

        <ListSection style={{ marginTop: theme.space.lg, marginHorizontal: -theme.space.lg }}>
          <ListRow first title="Justes" meta={`${summary.correct} / ${summary.asked}`} />
          <ListRow title="Précision" meta={`${accuracy} %`} />
          <ListRow title="Meilleure série" meta={`${summary.bestCombo}`} />
          <ListRow title="Temps médian" meta={`${(summary.medianElapsed / 1000).toFixed(1)} s`} />
          <ListRow title="Durée" meta={formatDuration(summary.duration)} />
          {isDaily ? <ListRow title="Série quotidienne" meta={`${streak} j`} /> : null}
        </ListSection>

        {isDaily ? (
          <View
            style={{
              marginTop: theme.space.lg,
              paddingVertical: theme.space.md,
              alignItems: 'center',
            }}
          >
            <Text variant="title" style={{ letterSpacing: 4 }}>
              {session.answers.map((a) => (a.correct ? '🟩' : '🟥')).join('')}
            </Text>
          </View>
        ) : null}

        {report ? <Events report={report} /> : null}
        {report ? <Ledger report={report} /> : null}
      </Animated.ScrollView>

      <View
        style={{
          paddingHorizontal: theme.space.lg,
          paddingTop: theme.space.sm,
          paddingBottom: insets.bottom + theme.space.md,
          gap: theme.space.xs,
          borderTopWidth: theme.borderWidth.hair,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.canvas,
        }}
      >
        {isDaily ? (
          <Button
            label="Partager le relevé"
            size="lg"
            tone="reward"
            block
            onPress={() => void Share.share({ message: emojiSummary(session, todayKey) })}
          />
        ) : (
          <Button
            label={next.action}
            detail={`${next.title} · ${next.duration}`}
            size="lg"
            tone={next.id === 'expedition' ? 'danger' : 'success'}
            block
            /* `launch` installs the next session; clearing first would wipe it. */
            onPress={() => launch(next.atlasId, next.id)}
          />
        )}
        <Button label="Revenir au port" variant="ghost" block onPress={port} />
      </View>
    </View>
  );
}

function ScoreDial({ score, record }: { score: number; record: boolean }) {
  const theme = useTheme();
  const emphasis = useEmphasis(0.72);

  const play = emphasis.play;
  useEffect(() => {
    play();
  }, [play]);

  return (
    <Animated.View style={[{ alignItems: 'flex-start' }, emphasis.style]}>
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

/**
 * A promotion and a brevet are objects, so they keep a frame. Everything else
 * on this screen is a list.
 */
function Events({ report }: { report: SessionReport }) {
  const theme = useTheme();

  const before = rankFor(report.xpBefore);
  const after = rankFor(report.xpAfter);
  const promoted = after.index > before.index;

  if (!promoted && report.brevets.length === 0) return null;

  return (
    <View style={{ marginTop: theme.space.lg, gap: theme.space.sm }}>
      {promoted ? (
        <PaperSurface
          tone="raised"
          bordered
          radius="lg"
          grain={0.3}
          elevation="lifted"
          style={{ padding: theme.space.lg }}
        >
          <Text variant="cartouche" color="info">
            Promotion
          </Text>
          <Text variant="titleLg" style={{ marginTop: theme.space.xxs }}>
            {after.name}
          </Text>
          <Text variant="caption" color="textSecondary" style={{ marginTop: theme.space.xxs }}>
            {before.name} → {after.name}
          </Text>
        </PaperSurface>
      ) : null}

      {report.brevets.map((id) => {
        const brevet = brevetById(id);
        if (!brevet) return null;
        return (
          <PaperSurface
            key={id}
            tone="raised"
            bordered
            radius="lg"
            grain={0.3}
            elevation="lifted"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              padding: theme.space.lg,
              borderColor: theme.colors.reward,
            }}
          >
            <IconBrevet size={26} color={theme.colors.rewardStrong} active />
            <View style={{ flex: 1 }}>
              <Text variant="cartouche" color="rewardStrong">
                Brevet
              </Text>
              <Text variant="title">{brevet.name}</Text>
              <Text variant="caption" color="textSecondary">
                {brevet.detail}
              </Text>
            </View>
            <Text variant="numeralSm" color="rewardStrong" tabular>
              +{brevet.reward}
            </Text>
          </PaperSurface>
        );
      })}
    </View>
  );
}

/** The detail of the payout, folded away by default. */
function Ledger({ report }: { report: SessionReport }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const total = report.earnings.doublons + report.brevetDoublons + report.carnet.doublons;
  if (total === 0 && report.earnings.xp === 0) return null;

  return (
    <View style={{ marginTop: theme.space.lg }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Gains, ${total} doublons`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          minHeight: theme.hitTarget.comfortable,
        }}
      >
        <IconDoublon size={20} color={theme.colors.reward} active />
        <Text variant="label" style={{ flex: 1 }}>
          Gains
        </Text>
        <Text variant="numeralSm" tabular>
          +{total}
        </Text>
        {report.earnings.xp > 0 ? (
          <Text variant="numeralSm" color="info" tabular>
            +{report.earnings.xp} xp
          </Text>
        ) : null}
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <IconChevron size={18} color={theme.colors.textTertiary} />
        </View>
      </Pressable>

      {open ? (
        <View style={{ marginHorizontal: -theme.space.lg }}>
          {report.earnings.lines.map((line, i) => (
            <ListRow
              key={line.label}
              first={i === 0}
              title={line.label}
              meta={`+${line.doublons}`}
              trailing={
                line.xp > 0 ? (
                  <Text variant="numeralSm" color="info" tabular>
                    +{line.xp} xp
                  </Text>
                ) : undefined
              }
            />
          ))}
          {report.carnet.doublons > 0 ? (
            <ListRow
              title={`Carnet de bord — ${report.carnet.completed} objectif${report.carnet.completed > 1 ? 's' : ''}`}
              meta={`+${report.carnet.doublons}`}
            />
          ) : null}
          {report.brevetDoublons > 0 ? (
            <ListRow title="Brevets" meta={`+${report.brevetDoublons}`} />
          ) : null}
        </View>
      ) : null}
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
});
