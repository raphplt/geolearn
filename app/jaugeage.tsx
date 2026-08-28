import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import {
  applyAnswer,
  CALIBRATION_LENGTH,
  isDone,
  nextQuestion,
  rungFrom,
  startCalibration,
} from '@/game/calibration';
import { rungAt } from '@/game/ladder';
import type { Question } from '@/game/questions';
import { createRng, seedFrom } from '@/game/rng';
import { failure, success, tap } from '@/fx/haptics';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { highlightFrame } from '@/map/framing';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Flag } from '@/ui/Flag';
import { Text } from '@/ui/Text';

export default function Jaugeage() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ atlas?: string; from?: string }>();

  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);

  const atlasId: AtlasId =
    params.atlas === 'world-countries' || params.atlas === 'france-departments'
      ? params.atlas
      : settings.lastAtlas;
  const atlas = ATLASES[atlasId];

  const rng = useRef(createRng(seedFrom(`jaugeage:${Date.now()}`)));
  const [state, setState] = useState(() => startCalibration(atlasId));
  const [question, setQuestion] = useState<Question | null>(() =>
    nextQuestion(startCalibration(atlasId), rng.current),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [floor, setFloor] = useState<number | null>(null);

  const bar = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  const answer = useCallback(
    (chosenId: string) => {
      if (!question || picked) return;
      const correct = chosenId === question.answerId;
      if (correct) success();
      else failure();
      setPicked(chosenId);

      setTimeout(() => {
        const next = applyAnswer(state, question.answerId, correct);
        bar.value = withTiming(next.step / CALIBRATION_LENGTH, { duration: 240 });
        setPicked(null);
        setState(next);

        if (isDone(next)) {
          setFloor(rungFrom(next));
          setQuestion(null);
          return;
        }
        setQuestion(nextQuestion(next, rng.current));
      }, correct ? 420 : 900);
    },
    [question, picked, state, bar],
  );

  const finish = useCallback(() => {
    updateSettings({ lastAtlas: atlasId, floor: floor ?? 0, onboarded: true });
    router.replace(params.from === 'cabine' ? '/' : '/decouverte');
  }, [updateSettings, atlasId, floor, params.from]);

  if (floor !== null) {
    const rung = rungAt(atlasId, floor);
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
          entering={FadeIn.duration(400)}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.sm }}
        >
          <Text variant="cartouche" color="textTertiary">
            Votre point de départ
          </Text>
          <Text variant="displayXL" align="center">
            {rung.name}
          </Text>
          <Text variant="numeral" color="textSecondary" tabular>
            {state.correct}/{CALIBRATION_LENGTH}
          </Text>
        </Animated.View>

        <Button label="Continuer" size="lg" tone="success" block onPress={finish} />
      </View>
    );
  }

  if (!question) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
        <View style={{ flex: 1 }} />
        <View style={{ padding: theme.space.xl, paddingBottom: insets.bottom + theme.space.lg }}>
          <Button
            label="Passer"
            variant="secondary"
            block
            onPress={() => {
              updateSettings({ lastAtlas: atlasId, floor: 0, onboarded: true });
              router.replace('/decouverte');
            }}
          />
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
      <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm }}>
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
      </View>

      <Animated.View
        key={question.id}
        entering={FadeIn.duration(220)}
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
      </Animated.View>

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
            paddingHorizontal: theme.space.xl,
            paddingBottom: insets.bottom + theme.space.lg,
            gap: theme.space.sm,
          }}
        >
          {question.choices.map((choice) => (
            <Choice
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

function Choice({
  label,
  flagCode,
  state,
  onPress,
  disabled,
}: {
  label: string;
  flagCode?: string;
  state: 'idle' | 'correct' | 'wrong' | 'dimmed';
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();

  const palette =
    state === 'correct'
      ? { bg: theme.colors.successSoft, border: theme.colors.success }
      : state === 'wrong'
        ? { bg: theme.colors.dangerSoft, border: theme.colors.danger }
        : { bg: theme.colors.surfaceRaised, border: theme.colors.border };

  return (
    <Animated.View entering={FadeInDown.duration(200)}>
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        disabled={disabled}
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
