import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, InteractionManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES } from '@/data';
import { failure, milestone, success, tap } from '@/fx/haptics';
import type { Question } from '@/game/questions';
import { comboMultiplier, currentQuestion, RULES, summarize } from '@/game/session';
import type { HintId } from '@/game/economy';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { assistFrame, highlightFrame } from '@/map/framing';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { CompassRose } from '@/ui/brand/CompassRose';
import { IconHull } from '@/ui/icons';
import { Flag } from '@/ui/Flag';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

const FEEDBACK_MS = { correct: 620, wrong: 1_500 };

type Feedback = {
  question: Question;
  chosenId: string | null;
  correct: boolean;
};

export default function Play() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const session = useSession((s) => s.session);
  const summary = useSession((s) => s.summary);
  const pending = useSession((s) => s.pending);
  const startPending = useSession((s) => s.startPending);
  const submit = useSession((s) => s.answer);
  const recordSession = useProgress((s) => s.recordSession);
  const setReport = useSession((s) => s.setReport);

  const [weighed, setWeighed] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const task = InteractionManager.runAfterInteractions(() => startPending());
    return () => task.cancel();
  }, [pending, startPending]);

  useEffect(() => {
    const timer = setTimeout(() => setWeighed(true), 620);
    return () => clearTimeout(timer);
  }, []);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [sounded, setSounded] = useState(false);
  const hints = useProgress((s) => s.purse.hints);
  const useHint = useProgress((s) => s.useHint);
  const repair = useSession((s) => s.repair);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorded = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rescuable =
    session?.status === 'finished' &&
    session.endReason === 'wrecked' &&
    (hints['seconde-chance'] ?? 0) > 0 &&
    !recorded.current;

  useEffect(() => {
    if (!session || session.status !== 'finished' || !summary || recorded.current) return;
    if (rescuable) return;
    recorded.current = true;
    setReport(recordSession(session, summary));
    exitTimer.current = setTimeout(() => router.replace('/results'), feedback ? 700 : 0);
  }, [session, summary, recordSession, setReport, feedback, rescuable]);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );

  const question = session ? currentQuestion(session) : null;
  const shown = feedback?.question ?? question;

  const handleAnswer = useCallback(
    (chosenId: string | null) => {
      if (!session || feedback || !question) return;

      const correct = chosenId === question.answerId;
      const nextCombo = correct ? session.combo + 1 : 0;

      if (!correct) failure();
      else if (comboMultiplier(nextCombo) > comboMultiplier(session.combo)) milestone();
      else success();

      setFeedback({ question, chosenId, correct });
      const next = submit(chosenId);

      const finished = next?.status === 'finished';
      if (finished) return;

      feedbackTimer.current = setTimeout(
        () => {
          setFeedback(null);
          setDropped([]);
          setSounded(false);
        },
        correct ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong,
      );
    },
    [session, question, feedback, submit],
  );

  const states = useMemo(() => {
    const out: Record<string, TerritoryState> = {};
    if (!shown) return out;
    if (feedback) {
      out[feedback.question.answerId] = feedback.correct ? 'correct' : 'reveal';
      if (!feedback.correct && feedback.chosenId) out[feedback.chosenId] = 'wrong';
    } else if (shown.mode === 'choice' && shown.highlightId) {
      out[shown.highlightId] = 'target';
    }
    return out;
  }, [feedback, shown]);

  if (pending || !weighed) return <Casting ready={Boolean(session)} />;

  if (session?.status === 'finished' && rescuable) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.canvas }]}>
        <Wreck
          onRepair={() => {
            if (!useHint('seconde-chance')) return;
            milestone();
            setFeedback(null);
            setDropped([]);
            setSounded(false);
            repair();
          }}
          onGiveUp={() => {
            tap();
            if (!session || !summary) return;
            recorded.current = true;
            setReport(recordSession(session, summary));
            router.replace('/results');
          }}
        />
      </View>
    );
  }

  if (!session || !shown) {
    if (session) return <Casting ready />;
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.canvas }]}>
        <Text variant="note" color="textSecondary">
          Aucune partie en cours.
        </Text>
        <Pressable onPress={() => router.replace('/')} style={{ marginTop: theme.space.lg }}>
          <Text variant="label" color="danger">
            Revenir à l’accueil
          </Text>
        </Pressable>
      </View>
    );
  }

  const atlas = ATLASES[shown.atlasId];

  const showMap = shown.mode === 'locate' || Boolean(shown.highlightId) || Boolean(feedback);

  const frame = sounded
    ? assistFrame(atlas, shown.answerId, 0.26)
    : shown.mode === 'choice'
      ? highlightFrame(atlas, shown.answerId, session.config.assist)
      : assistFrame(atlas, shown.answerId, session.config.assist);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <SessionHeader />

      <View style={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md }}>
        <Prompt question={shown} feedback={feedback} />
      </View>

      {showMap ? (
        <AtlasMap
          atlas={atlas}
          states={states}
          onSelect={shown.mode === 'locate' && !feedback ? handleAnswer : undefined}
          labels="none"
          viewBox={frame}
          style={{ flex: 1, marginHorizontal: theme.space.lg }}
        />
      ) : (
        <View style={styles.emptyStage} pointerEvents="none">
          <CompassRose size={260} points={16} dial opacity={0.08} />
        </View>
      )}

      <HintBar
        question={shown}
        held={hints}
        used={{ dropped: dropped.length > 0, sounded }}
        locked={Boolean(feedback)}
        onDrop={() => {
          if (!useHint('delester')) return;
          if (shown.mode !== 'choice') return;
          const wrong = shown.choices.filter((c) => c.id !== shown.answerId).map((c) => c.id);
          for (let i = wrong.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [wrong[i], wrong[j]] = [wrong[j]!, wrong[i]!];
          }
          milestone();
          setDropped(wrong.slice(0, 2));
        }}
        onSound={() => {
          if (!useHint('sonder')) return;
          milestone();
          setSounded(true);
        }}
      />

      {shown.mode === 'choice' ? (
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: theme.space.xl,
            paddingBottom: insets.bottom + theme.space.lg,
            gap: theme.space.sm,
          }}
        >
          {shown.choices.map((choice) => (
            <ChoiceRow
              key={choice.id}
              label={choice.label}
              flagCode={choice.flagCode}
              state={
                !feedback
                  ? dropped.includes(choice.id)
                    ? 'dimmed'
                    : 'idle'
                  : choice.id === feedback.question.answerId
                    ? 'correct'
                    : choice.id === feedback.chosenId
                      ? 'wrong'
                      : 'dimmed'
              }
              onPress={() => handleAnswer(choice.id)}
              disabled={Boolean(feedback) || dropped.includes(choice.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={{ height: insets.bottom + theme.space.lg }} />
      )}

    </View>
  );
}

function HintBar({
  question,
  held,
  used,
  locked,
  onDrop,
  onSound,
}: {
  question: Question;
  held: Partial<Record<HintId, number>>;
  used: { dropped: boolean; sounded: boolean };
  locked: boolean;
  onDrop: () => void;
  onSound: () => void;
}) {
  const theme = useTheme();

  const canDrop =
    question.mode === 'choice' && !used.dropped && (held.delester ?? 0) > 0 && !locked;
  const canSound =
    question.mode === 'locate' && !used.sounded && (held.sonder ?? 0) > 0 && !locked;

  if (!canDrop && !canSound) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.lg,
        paddingTop: theme.space.sm,
      }}
    >
      {canDrop ? (
        <HintChip label="Délester" count={held.delester ?? 0} onPress={onDrop} />
      ) : null}
      {canSound ? (
        <HintChip label="Sonder" count={held.sonder ?? 0} onPress={onSound} />
      ) : null}
    </View>
  );
}

function HintChip({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} en réserve`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.xs,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.infoSoft,
        borderWidth: theme.borderWidth.hair,
        borderColor: theme.colors.info,
      }}
    >
      <Text variant="labelSm" color="info">
        {label}
      </Text>
      <Text variant="numeralSm" color="info" tabular>
        ×{count}
      </Text>
    </Pressable>
  );
}

function Wreck({ onRepair, onGiveUp }: { onRepair: () => void; onGiveUp: () => void }) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.colors.scrim,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.space.xl,
        },
      ]}
    >
      <PaperSurface
        tone="raised"
        bordered
        radius="lg"
        grain={0.3}
        elevation="overlay"
        style={{ padding: theme.space.xl, alignItems: 'center', gap: theme.space.md }}
      >
        <IconHull size={40} color={theme.colors.danger} />
        <Text variant="titleLg" align="center">
          Coque ouverte
        </Text>
        <Button label="Réparer la coque" tone="success" block onPress={onRepair} />
        <Button label="Rentrer au port" variant="secondary" block onPress={onGiveUp} />
      </PaperSurface>
    </Animated.View>
  );
}

function SessionHeader() {
  const theme = useTheme();
  const session = useSession((s) => s.session);
  const expireSession = useSession((s) => s.expire);
  const clearSession = useSession((s) => s.clear);
  const recordSession = useProgress((s) => s.recordSession);

  const progress = useSharedValue(1);
  const expiresAt = session?.expiresAt ?? null;

  useEffect(() => {
    if (expiresAt === null) return;
    const remaining = Math.max(0, expiresAt - Date.now());
    progress.value = Math.min(1, remaining / RULES.timeCap);
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear });

    const timer = setTimeout(() => expireSession(), remaining);
    return () => clearTimeout(timer);
  }, [expiresAt, progress, expireSession]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, progress.value) * 100}%`,
  }));

  const quit = () => {
    if (!session) {
      router.replace('/');
      return;
    }

    if (session.answers.length === 0) {
      clearSession();
      router.replace('/');
      return;
    }

    Alert.alert(
      'Abandonner la partie ?',
      'Vos réponses restent acquises. Le score ne sera pas retenu.',
      [
        { text: 'Continuer', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: () => {
            const now = Date.now();
            recordSession({ ...session, score: 0 }, { ...summarize(session, now), score: 0 }, now);
            clearSession();
            router.replace('/');
          },
        },
      ],
    );
  };

  if (!session) return null;

  const multiplier = comboMultiplier(session.combo);
  const total = session.config.mode === 'expedition' ? null : session.questions.length;

  return (
    <View style={{ paddingHorizontal: theme.space.lg }}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            tap();
            quit();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Abandonner la partie"
        >
          <Text variant="title" color="textTertiary">
            ✕
          </Text>
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text variant="numeral" tabular>
            {session.score}
          </Text>
          {total ? (
            <Text variant="caption" color="textTertiary" tabular>
              {Math.min(session.index + 1, total)} / {total}
            </Text>
          ) : null}
        </View>

        <ComboBadge combo={session.combo} multiplier={multiplier} />
      </View>

      {session.config.lives !== undefined ? (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: theme.space.xs }}>
          {Array.from({ length: session.config.lives }, (_, i) => (
            <IconHull
              key={i}
              size={15}
              active={i >= session.wrecks}
              color={
                i >= session.wrecks ? theme.colors.textSecondary : theme.colors.dangerSoft
              }
            />
          ))}
        </View>
      ) : null}

      {expiresAt !== null ? (
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.surfaceSunk,
            overflow: 'hidden',
            marginTop: theme.space.sm,
          }}
        >
          <Animated.View
            style={[{ height: '100%', backgroundColor: theme.colors.danger }, barStyle]}
          />
        </View>
      ) : null}
    </View>
  );
}

function ComboBadge({ combo, multiplier }: { combo: number; multiplier: number }) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (combo === 0) return;
    scale.value = withSpring(1.18, theme.motion.spring.pop, () => {
      scale.value = withSpring(1, theme.motion.spring.pop);
    });
  }, [combo, scale, theme.motion.spring.pop]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ minWidth: 62, alignItems: 'flex-end' }, style]}>
      {combo > 0 ? (
        <>
          <Text variant="numeral" color={multiplier > 1 ? 'reward' : 'textSecondary'} tabular>
            ×{multiplier}
          </Text>
        </>
      ) : null}
    </Animated.View>
  );
}

function Prompt({ question, feedback }: { question: Question; feedback: Feedback | null }) {
  const theme = useTheme();

  const verdict = feedback
    ? feedback.correct
      ? { label: 'Juste', color: theme.colors.success }
      : { label: answerLabel(feedback.question), color: theme.colors.danger }
    : null;

  return (
    <View style={{ alignItems: 'center', gap: theme.space.md }}>
      <View
        style={{
          paddingHorizontal: theme.space.lg,
          paddingVertical: theme.space.sm,
          borderRadius: theme.radius.pill,
          backgroundColor: verdict
            ? feedback?.correct
              ? theme.colors.successSoft
              : theme.colors.dangerSoft
            : theme.colors.surfaceRaised,
          borderWidth: theme.borderWidth.hair,
          borderColor: verdict ? verdict.color : theme.colors.border,
          maxWidth: '100%',
        }}
      >
        <Text
          variant="label"
          align="center"
          numberOfLines={2}
          style={verdict ? { color: verdict.color } : undefined}
        >
          {verdict?.label ?? question.prompt}
        </Text>
      </View>

      {question.flagCode && !question.subject ? (
        <Flag cca2={question.flagCode} width={230} height={145} radius={theme.radius.sm} />
      ) : null}

      {question.subject ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          {question.flagCode ? (
            <Flag cca2={question.flagCode} height={34} radius={theme.radius.xs} />
          ) : null}
          <Text variant="display" numberOfLines={2} align="center">
            {question.subject}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function answerLabel(question: Question): string {
  if (question.mode === 'choice') {
    const answer = question.choices.find((c) => c.id === question.answerId);
    return answer ? `C’était ${answer.label}` : '';
  }
  return `C’était ${question.subject}`;
}

type ChoiceState = 'idle' | 'correct' | 'wrong' | 'dimmed';

function ChoiceRow({
  label,
  flagCode,
  state,
  onPress,
  disabled,
}: {
  label: string;
  flagCode?: string;
  state: ChoiceState;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
  }));

  const palette =
    state === 'correct'
      ? { bg: theme.colors.successSoft, border: theme.colors.success }
      : state === 'wrong'
        ? { bg: theme.colors.dangerSoft, border: theme.colors.danger }
        : { bg: theme.colors.surfaceRaised, border: theme.colors.border };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => {
          pressed.value = withSpring(1, theme.motion.spring.snappy);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, theme.motion.spring.snappy);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          minHeight: theme.hitTarget.comfortable,
          paddingHorizontal: theme.space.lg,
          borderRadius: theme.radius.md,
          backgroundColor: palette.bg,
          borderWidth: theme.borderWidth.thin,
          borderColor: palette.border,
          opacity: state === 'dimmed' ? theme.opacity.disabled : 1,
        }}
      >
        {flagCode ? <Flag cca2={flagCode} height={22} radius={theme.radius.xs} /> : null}
        <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function Casting({ ready }: { ready: boolean }) {
  const theme = useTheme();
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <Animated.View
      exiting={FadeOut.duration(240)}
      style={[styles.centered, { backgroundColor: theme.colors.canvas }]}
    >
      <Animated.View style={style}>
        <CompassRose size={112} points={16} dial opacity={ready ? 0.5 : 0.32} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  emptyStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
