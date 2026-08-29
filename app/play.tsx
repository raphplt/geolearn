import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES } from '@/data';
import type { Territory } from '@/data/types';
import { failure, milestone, success } from '@/fx/haptics';
import { probe } from '@/fx/probe';
import type { Question } from '@/game/questions';
import { comboMultiplier, currentQuestion, summarize } from '@/game/session';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { assistFrame, highlightFrame } from '@/map/framing';
import { warmHitIndex } from '@/map/geometry';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { CompassRose } from '@/ui/brand/CompassRose';
import { ChoiceRow } from '@/ui/game/ChoiceRow';
import { HintBar } from '@/ui/game/HintBar';
import { QuestionPrompt } from '@/ui/game/QuestionPrompt';
import { SessionHeader } from '@/ui/game/SessionHeader';
import { ListRow } from '@/ui/List';
import { useReducedMotion } from '@/ui/motion';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

export default function Play() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const session = useSession((s) => s.session);
  const submit = useSession((s) => s.answer);
  const step = useSession((s) => s.advance);
  const repair = useSession((s) => s.repair);
  const setReport = useSession((s) => s.setReport);
  const recordSession = useProgress((s) => s.recordSession);

  const hints = useProgress((s) => s.purse.hints);
  const spendHint = useProgress((s) => s.spendHint);

  const [dropped, setDropped] = useState<string[]>([]);
  const [sounded, setSounded] = useState(false);
  const [listing, setListing] = useState(false);

  const dwell = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorded = useRef(false);

  const phase = session?.phase ?? 'asking';
  const question = session ? currentQuestion(session) : null;
  const last = session?.last ?? null;
  const atlasId = session?.config.atlasId;

  useEffect(() => {
    if (!atlasId) return;
    warmHitIndex(ATLASES[atlasId]);
  }, [atlasId]);

  /*
   * `recorded` guards the callbacks, not the render: by the time it is true the
   * screen is already on its way out, and reading a ref while rendering makes
   * the result depend on when React happens to run.
   */
  const rescuable =
    session?.status === 'finished' &&
    session.endReason === 'wrecked' &&
    (hints['seconde-chance'] ?? 0) > 0;

  /* Move on: to the next question while playing, to the log once finished. */
  const forward = useCallback(() => {
    if (dwell.current) {
      clearTimeout(dwell.current);
      dwell.current = null;
    }
    const current = useSession.getState().session;
    if (!current) return;

    if (current.status === 'playing') {
      if (current.phase !== 'feedback') return;
      setDropped([]);
      setSounded(false);
      step();
      return;
    }

    if (recorded.current) return;
    recorded.current = true;

    const done = useSession.getState().summary;
    if (!done || done.asked === 0) {
      useSession.getState().clear();
      router.replace('/');
      return;
    }
    setReport(recordSession(current, done));
    router.replace('/results');
  }, [step, setReport, recordSession]);

  /*
   * One timer governs the whole end of a question: the verdict is read, then
   * the next one arrives — or the log does. A session can also end with no
   * verdict on screen, when the time bank runs out mid-question; that case
   * leaves immediately rather than stranding the player on a dead board.
   */
  useEffect(() => {
    if (!session || rescuable) return;

    const showing = session.phase === 'feedback';
    if (showing) probe.reacted('answer');

    const finished = session.status === 'finished';
    if (!showing && !finished) return;

    const wait = showing
      ? session.last?.correct
        ? theme.motion.feedback.correct
        : theme.motion.feedback.wrong
      : 0;

    dwell.current = setTimeout(forward, wait);
    return () => {
      if (dwell.current) clearTimeout(dwell.current);
      dwell.current = null;
    };
  }, [session, rescuable, forward, theme.motion.feedback]);

  const answer = useCallback(
    (chosenId: string | null) => {
      const current = useSession.getState().session;
      if (!current || current.phase !== 'asking') return;

      const asked = currentQuestion(current);
      if (!asked) return;

      const correct = chosenId === asked.answerId;
      const nextCombo = correct ? current.combo + 1 : 0;

      probe.touched('answer');

      if (!correct) failure();
      else if (comboMultiplier(nextCombo) > comboMultiplier(current.combo)) milestone();
      else success();

      submit(chosenId);
    },
    [submit],
  );

  const states = useMemo(() => {
    const out: Record<string, TerritoryState> = {};
    if (!question) return out;
    if (phase === 'feedback' && last) {
      out[question.answerId] = last.correct ? 'correct' : 'reveal';
      if (!last.correct && last.chosenId) out[last.chosenId] = 'wrong';
    } else if (question.mode === 'choice' && question.highlightId) {
      out[question.highlightId] = 'target';
    }
    return out;
  }, [phase, last, question]);

  const quit = useCallback(() => {
    const current = useSession.getState().session;
    if (!current || current.answers.length === 0) {
      useSession.getState().clear();
      router.replace('/');
      return true;
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
            recorded.current = true;
            recordSession({ ...current, score: 0 }, { ...summarize(current, now), score: 0 }, now);
            useSession.getState().clear();
            router.replace('/');
          },
        },
      ],
    );
    return true;
  }, [recordSession]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', quit);
    return () => subscription.remove();
  }, [quit]);

  if (!session || !question) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.canvas }]}>
        <Text variant="note" color="textSecondary">
          Aucune partie en cours.
        </Text>
        <Button
          label="Revenir au port"
          variant="secondary"
          onPress={() => router.replace('/')}
          style={{ marginTop: theme.space.lg }}
        />
      </View>
    );
  }

  const atlas = ATLASES[question.atlasId];
  const showMap =
    question.mode === 'locate' || Boolean(question.highlightId) || phase === 'feedback';

  const frame = sounded
    ? assistFrame(atlas, question.answerId, 0.26)
    : question.mode === 'choice'
      ? highlightFrame(atlas, question.answerId, session.config.assist)
      : assistFrame(atlas, question.answerId, session.config.assist);

  const locked = phase === 'feedback';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <SessionHeader onQuit={quit} />

      <QuestionStage index={session.index} reduced={reduced}>
        <View style={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md }}>
          <QuestionPrompt question={question} verdict={locked ? last : null} />
        </View>

        {showMap ? (
          <AtlasMap
            atlas={atlas}
            states={states}
            onSelect={question.mode === 'locate' && !locked ? answer : undefined}
            labels="none"
            viewBox={frame}
            zoomable={false}
            style={{ flex: 1, marginHorizontal: theme.space.lg }}
          />
        ) : (
          <View style={styles.emptyStage} pointerEvents="none">
            <CompassRose size={260} points={16} dial opacity={0.08} />
          </View>
        )}

        <HintBar
          question={question}
          held={hints}
          used={{ dropped: dropped.length > 0, sounded }}
          locked={locked}
          onList={question.mode === 'locate' ? () => setListing(true) : undefined}
          onDrop={() => {
            if (question.mode !== 'choice') return;
            if (!spendHint('delester')) return;
            milestone();
            const wrong = question.choices
              .filter((c) => c.id !== question.answerId)
              .map((c) => c.id);
            setDropped(wrong.slice(0, 2));
          }}
          onSound={() => {
            if (!spendHint('sonder')) return;
            milestone();
            setSounded(true);
          }}
        />

        {question.mode === 'choice' ? (
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              paddingHorizontal: theme.space.lg,
              paddingBottom: insets.bottom + theme.space.lg,
              paddingTop: theme.space.sm,
              gap: theme.space.sm,
            }}
          >
            {question.choices.map((choice) => (
              <ChoiceRow
                key={choice.id}
                label={choice.label}
                flagCode={choice.flagCode}
                state={
                  !locked
                    ? dropped.includes(choice.id)
                      ? 'dimmed'
                      : 'idle'
                    : choice.id === question.answerId
                      ? 'correct'
                      : choice.id === last?.chosenId
                        ? 'wrong'
                        : 'dimmed'
                }
                onPress={() => answer(choice.id)}
                disabled={locked || dropped.includes(choice.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={{ height: insets.bottom + theme.space.lg }} />
        )}
      </QuestionStage>

      {/* During a verdict, anywhere on the screen means "next". */}
      {locked && !rescuable ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={forward}
          accessibilityRole="button"
          accessibilityLabel="Question suivante"
        />
      ) : null}

      <Sheet
        visible={listing}
        onClose={() => setListing(false)}
        eyebrow="Sans pointer sur la carte"
        title={question.subject || question.prompt}
      >
        <View style={{ paddingTop: theme.space.md }}>
          {namedCandidates(atlas.territories, question).map((t, i) => (
            <ListRow
              key={t.id}
              first={i === 0}
              title={t.name}
              onPress={() => {
                setListing(false);
                answer(t.id);
              }}
            />
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={Boolean(rescuable)}
        onClose={() => {
          setListing(false);
          forward();
        }}
        eyebrow="Avarie"
        title="Coque ouverte"
        footer={
          <View style={{ gap: theme.space.sm }}>
            <Button
              label="Réparer la coque"
              detail="Consomme une seconde chance"
              tone="success"
              block
              onPress={() => {
                if (!spendHint('seconde-chance')) return;
                milestone();
                setDropped([]);
                setSounded(false);
                repair();
              }}
            />
            <Button label="Rentrer au port" variant="secondary" block onPress={forward} />
          </View>
        }
      >
        <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm }}>
          <Text variant="bodySm" color="textSecondary">
            La partie s’arrête ici, à moins de réparer. Le score et les réponses déjà données
            restent acquis dans les deux cas.
          </Text>
        </View>
      </Sheet>
    </View>
  );
}

/**
 * The next question slides in from the direction of progress, once, on the UI
 * thread, without remounting the screen underneath.
 */
function QuestionStage({
  index,
  reduced,
  children,
}: {
  index: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const shift = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    shift.value = 22;
    shift.value = withTiming(0, {
      duration: theme.motion.duration.base,
      easing: Easing.out(Easing.quad),
    });
  }, [index, reduced, shift, theme.motion.duration.base]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}

const CANDIDATES = 6;

/**
 * Pointing at a shape is not available to everyone. The same question is
 * answerable from a short alphabetical list of the territories a player could
 * plausibly confuse with the right one.
 */
function namedCandidates(territories: readonly Territory[], question: Question): Territory[] {
  const answer = territories.find((t) => t.id === question.answerId);
  if (!answer) return [];

  const byId = new Map(territories.map((t) => [t.id, t]));
  const picked = new Map<string, Territory>([[answer.id, answer]]);

  for (const id of answer.neighbors) {
    const neighbour = byId.get(id);
    if (neighbour) picked.set(id, neighbour);
    if (picked.size >= CANDIDATES) break;
  }

  if (picked.size < CANDIDATES) {
    const near = territories
      .filter((t) => t.d !== '' && !picked.has(t.id))
      .map((t) => ({
        t,
        d: Math.hypot(t.label[0] - answer.label[0], t.label[1] - answer.label[1]),
      }))
      .sort((a, b) => a.d - b.d);

    for (const { t } of near) {
      picked.set(t.id, t);
      if (picked.size >= CANDIDATES) break;
    }
  }

  return [...picked.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
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
