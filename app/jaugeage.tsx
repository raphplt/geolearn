import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import {
  applyAnswer,
  CALIBRATION_LENGTH,
  isDone,
  nextQuestion,
  rungFrom,
  startCalibration,
  type Calibration,
} from '@/game/calibration';
import { rungAt } from '@/game/ladder';
import type { Question } from '@/game/questions';
import { createRng, seedFrom } from '@/game/rng';
import { failure, success } from '@/fx/haptics';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { highlightFrame } from '@/map/framing';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { ChoiceRow } from '@/ui/game/ChoiceRow';
import { Flag } from '@/ui/Flag';
import { useEmphasis } from '@/ui/motion';
import { Text } from '@/ui/Text';

export default function Jaugeage() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ atlas?: string; then?: string; from?: string }>();

  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const setFloor = useProgress((s) => s.setFloor);

  /*
   * Someone who chose to learn both atlases gauges them one after the other,
   * in this screen rather than through the router: replaying the same route
   * would not remount it, and the calibration would carry over.
   */
  const queue = useMemo(
    () =>
      [asAtlas(params.atlas) ?? settings.lastAtlas, asAtlas(params.then)].filter(
        (id): id is AtlasId => id !== null,
      ),
    [params.atlas, params.then, settings.lastAtlas],
  );

  const [at, setAt] = useState(0);
  const atlasId = queue[at] ?? settings.lastAtlas;
  const atlas = ATLASES[atlasId];

  /* The generator belongs to the run: replacing one replaces the other. */
  const [run, setRun] = useState(() => open(atlasId));
  const { state, question } = run;

  const [picked, setPicked] = useState<string | null>(null);
  const [floor, setFloorResult] = useState<number | null>(null);

  const bar = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  const answer = useCallback(
    (chosenId: string) => {
      if (!question || picked) return;
      const correct = chosenId === question.answerId;
      if (correct) success();
      else failure();
      setPicked(chosenId);

      setTimeout(
        () => {
          const next = applyAnswer(state, question.answerId, correct);
          bar.value = withTiming(next.step / CALIBRATION_LENGTH, {
            duration: theme.motion.duration.base,
          });
          setPicked(null);

          if (isDone(next)) {
            setRun((r) => ({ ...r, state: next, question: null }));
            setFloorResult(rungFrom(next));
            return;
          }
          setRun((r) => ({ ...r, state: next, question: nextQuestion(next, r.rng) }));
        },
        correct ? theme.motion.feedback.correct : theme.motion.feedback.wrong,
      );
    },
    [question, picked, state, bar, theme.motion],
  );

  const leave = useCallback(() => {
    updateSettings({ lastAtlas: queue[0] ?? atlasId, onboarded: true });
    router.replace(params.from === 'cabine' ? '/' : '/decouverte');
  }, [updateSettings, queue, atlasId, params.from]);

  const finish = useCallback(() => {
    setFloor(atlasId, floor ?? 0);
    leave();
  }, [setFloor, atlasId, floor, leave]);

  const skip = useCallback(() => {
    setFloor(atlasId, 0);
    leave();
  }, [setFloor, atlasId, leave]);

  /** Keeps the measured level and starts over on the next atlas of the queue. */
  const gaugeNext = useCallback(() => {
    setFloor(atlasId, floor ?? 0);

    const step = at + 1;
    const nextAtlas = queue[step];
    if (!nextAtlas) {
      leave();
      return;
    }

    bar.value = 0;
    setAt(step);
    setRun(open(nextAtlas));
    setPicked(null);
    setFloorResult(null);
  }, [setFloor, atlasId, floor, at, queue, bar, leave]);

  if (floor !== null) {
    const pending = queue[at + 1];
    return (
      <Verdict
        atlasId={atlasId}
        floor={floor}
        correct={state.correct}
        onNext={finish}
        pending={pending ?? null}
        onPending={gaugeNext}
      />
    );
  }

  if (!question) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
        <View style={{ flex: 1 }} />
        <View style={{ padding: theme.space.xl, paddingBottom: insets.bottom + theme.space.lg }}>
          <Button label="Passer le jaugeage" variant="secondary" block onPress={skip} />
        </View>
      </View>
    );
  }

  const states: Record<string, TerritoryState> = {};
  if (question.mode === 'choice' && question.highlightId) {
    states[question.highlightId] = picked
      ? picked === question.answerId
        ? 'correct'
        : 'wrong'
      : 'target';
  }
  const showMap = question.mode === 'choice' && Boolean(question.highlightId);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.md }}>
        <View
          style={{
            height: 5,
            borderRadius: 3,
            backgroundColor: theme.colors.surfaceSunk,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[{ height: '100%', backgroundColor: theme.colors.info }, barStyle]}
          />
        </View>
        <Text variant="caption" color="textTertiary" style={{ marginTop: theme.space.xs }}>
          Jaugeage · question {state.step + 1} sur {CALIBRATION_LENGTH}
        </Text>
      </View>

      <View
        style={{
          alignItems: 'center',
          gap: theme.space.md,
          paddingHorizontal: theme.space.xl,
          paddingTop: theme.space.lg,
        }}
      >
        <View
          style={{
            paddingHorizontal: theme.space.lg,
            paddingVertical: theme.space.sm,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surfaceRaised,
            borderWidth: theme.borderWidth.hair,
            borderColor: theme.colors.border,
          }}
        >
          <Text variant="label" align="center" numberOfLines={2}>
            {question.prompt}
          </Text>
        </View>

        {question.flagCode && !question.subject ? (
          <Flag cca2={question.flagCode} width={210} height={132} radius={theme.radius.sm} />
        ) : null}

        {question.subject ? (
          <Text variant="display" align="center" numberOfLines={2}>
            {question.subject}
          </Text>
        ) : null}
      </View>

      {showMap ? (
        <AtlasMap
          atlas={atlas}
          states={states}
          viewBox={highlightFrame(atlas, question.answerId, null)}
          labels="none"
          zoomable={false}
          style={{ flex: 1, margin: theme.space.xl, marginBottom: theme.space.md }}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {question.mode === 'choice' ? (
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            paddingHorizontal: theme.space.lg,
            paddingBottom: insets.bottom + theme.space.lg,
            gap: theme.space.sm,
          }}
        >
          {question.choices.map((choice) => (
            <ChoiceRow
              key={choice.id}
              label={choice.label}
              flagCode={choice.flagCode}
              state={
                !picked
                  ? 'idle'
                  : choice.id === question.answerId
                    ? 'correct'
                    : choice.id === picked
                      ? 'wrong'
                      : 'dimmed'
              }
              onPress={() => answer(choice.id)}
              disabled={Boolean(picked)}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const ATLAS_NAME: Record<AtlasId, string> = {
  'france-departments': 'la France',
  'world-countries': 'le monde',
};

const asAtlas = (value: string | undefined): AtlasId | null =>
  value === 'world-countries' || value === 'france-departments' ? value : null;

type Run = { rng: () => number; state: Calibration; question: Question | null };

/** One gauging run: its generator, its state, and the question on screen. */
function open(atlasId: AtlasId): Run {
  const rng = createRng(seedFrom(`jaugeage:${atlasId}:${Date.now()}`));
  const state = startCalibration(atlasId);
  return { rng, state, question: nextQuestion(state, rng) };
}

function Verdict({
  atlasId,
  floor,
  correct,
  onNext,
  pending,
  onPending,
}: {
  atlasId: AtlasId;
  floor: number;
  correct: number;
  onNext: () => void;
  pending: AtlasId | null;
  onPending: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const emphasis = useEmphasis(0.8);
  const rung = rungAt(atlasId, floor);

  const play = emphasis.play;
  useEffect(() => {
    play();
  }, [play]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.canvas,
        paddingTop: insets.top,
        paddingBottom: insets.bottom + theme.space.lg,
        paddingHorizontal: theme.space.xl,
      }}
    >
      <Animated.View
        style={[
          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.sm },
          emphasis.style,
        ]}
      >
        <Text variant="cartouche" color="textTertiary">
          Votre point de départ
        </Text>
        <Text variant="displayXL" align="center">
          {rung.name}
        </Text>
        <Text variant="note" color="textSecondary" align="center">
          {rung.motto}
        </Text>
        <Text variant="numeral" color="textSecondary" tabular style={{ marginTop: theme.space.md }}>
          {correct}/{CALIBRATION_LENGTH}
        </Text>
      </Animated.View>

      {pending ? (
        <View style={{ gap: theme.space.sm }}>
          <Button
            label={`Jauger ${ATLAS_NAME[pending]}`}
            detail="Huit questions de plus"
            size="lg"
            tone="success"
            block
            onPress={onPending}
          />
          <Button label="Plus tard" variant="ghost" block onPress={onNext} />
        </View>
      ) : (
        <Button label="Continuer" size="lg" tone="success" block onPress={onNext} />
      )}
    </View>
  );
}
