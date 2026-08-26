import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES } from '@/data';
import { failure, milestone, success, tap } from '@/fx/haptics';
import type { Question } from '@/game/questions';
import { comboMultiplier, currentQuestion, RULES } from '@/game/session';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { CompassRose } from '@/ui/brand/CompassRose';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

/** Durée d'affichage du verdict avant de passer à la question suivante. */
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
  const submit = useSession((s) => s.answer);
  const recordSession = useProgress((s) => s.recordSession);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorded = useRef(false);

  /* Fin de partie : on consigne la progression une seule fois, puis on cède la
     place à l'écran de bilan. Le garde `recorded` compte : ce composant peut se
     rendre à nouveau avant la navigation, et sans lui la partie serait comptée
     deux fois dans les statistiques. */
  useEffect(() => {
    if (!session || session.status !== 'finished' || !summary || recorded.current) return;
    recorded.current = true;
    recordSession(session, summary);
    const timer = setTimeout(() => router.replace('/results'), feedback ? 700 : 0);
    return () => clearTimeout(timer);
  }, [session, summary, recordSession, feedback]);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const question = session ? currentQuestion(session) : null;
  const shown = feedback?.question ?? question;

  const handleAnswer = useCallback(
    (chosenId: string | null) => {
      if (!session || feedback || !question) return;

      const correct = chosenId === question.answerId;
      const nextCombo = correct ? session.combo + 1 : 0;

      /* Le retour haptique précède l'animation : c'est lui qui donne la
         sensation d'immédiateté, et un décalage de quelques images se ressent. */
      if (!correct) failure();
      else if (comboMultiplier(nextCombo) > comboMultiplier(session.combo)) milestone();
      else success();

      setFeedback({ question, chosenId, correct });
      submit(chosenId);

      feedbackTimer.current = setTimeout(
        () => setFeedback(null),
        correct ? FEEDBACK_MS.correct : FEEDBACK_MS.wrong,
      );
    },
    [session, question, feedback, submit],
  );

  if (!session || !shown) {
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

  /* États de la carte. Pendant le verdict, on montre à la fois ce que le joueur
     a désigné et ce qu'il fallait désigner — l'erreur n'apprend rien si l'on ne
     voit pas le bon territoire à côté du mauvais. */
  const states: Record<string, TerritoryState> = {};
  if (feedback) {
    states[feedback.question.answerId] = feedback.correct ? 'correct' : 'reveal';
    if (!feedback.correct && feedback.chosenId) states[feedback.chosenId] = 'wrong';
  } else if (shown.mode === 'choice' && shown.highlightId) {
    states[shown.highlightId] = 'target';
  }

  const showMap = shown.mode === 'locate' || Boolean(shown.highlightId) || Boolean(feedback);

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
          interactive={shown.mode === 'locate'}
          labelThreshold={0}
          style={{ flex: 1, marginHorizontal: theme.space.sm }}
        />
      ) : (
        /* Les questions sans carte — drapeau, capitale vers pays — laisseraient
           sinon un grand vide au milieu de l'écran. La rose y tient lieu de
           filigrane : elle occupe l'espace sans rien réclamer au regard. */
        <View style={styles.emptyStage} pointerEvents="none">
          <CompassRose size={260} points={16} dial opacity={0.08} />
        </View>
      )}

      {shown.mode === 'choice' ? (
        <ScrollView
          contentContainerStyle={{
            padding: theme.space.lg,
            paddingBottom: insets.bottom + theme.space.lg,
            gap: theme.space.sm,
          }}
        >
          {shown.choices.map((choice) => (
            <ChoiceRow
              key={choice.id}
              label={choice.label}
              detail={choice.detail}
              emblem={choice.emblem}
              state={
                !feedback
                  ? 'idle'
                  : choice.id === feedback.question.answerId
                    ? 'correct'
                    : choice.id === feedback.chosenId
                      ? 'wrong'
                      : 'dimmed'
              }
              onPress={() => handleAnswer(choice.id)}
              disabled={Boolean(feedback)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={{ padding: theme.space.lg, paddingBottom: insets.bottom + theme.space.lg }}>
          <Text variant="caption" color="textTertiary" align="center">
            Touchez le territoire sur la carte
          </Text>
        </View>
      )}
    </View>
  );
}

/* ───────────────────── En-tête ───────────────────── */

function SessionHeader() {
  const theme = useTheme();
  const session = useSession((s) => s.session);
  const expireSession = useSession((s) => s.expire);

  const progress = useSharedValue(1);
  const expiresAt = session?.expiresAt ?? null;

  /*
   * Jauge de temps.
   *
   * Elle est animée à partir de la seule échéance, sur le fil d'animation :
   * aucun rendu React ne se produit pendant l'écoulement. Un compte à rebours
   * qui remonterait dans l'état déclencherait soixante rendus par seconde de
   * toute la hiérarchie, carte comprise.
   */
  useEffect(() => {
    if (expiresAt === null) return;
    const remaining = Math.max(0, expiresAt - Date.now());
    progress.value = Math.min(1, remaining / RULES.timeCap);
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear });

    /* Une minuterie distincte constate l'expiration : l'animation ne peut pas
       modifier l'état du jeu depuis le fil d'interface utilisateur. */
    const timer = setTimeout(() => expireSession(), remaining);
    return () => clearTimeout(timer);
  }, [expiresAt, progress, expireSession]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, progress.value) * 100}%`,
  }));

  if (!session) return null;

  const multiplier = comboMultiplier(session.combo);
  const total = session.config.mode === 'expedition' ? null : session.questions.length;

  return (
    <View style={{ paddingHorizontal: theme.space.lg }}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            tap();
            router.replace('/');
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Abandonner la partie"
        >
          <Text variant="labelSm" color="textTertiary">
            Quitter
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
          <Text variant="caption" color="textTertiary" tabular>
            {combo} d’affilée
          </Text>
        </>
      ) : (
        <Text variant="caption" color="textTertiary">
          série rompue
        </Text>
      )}
    </Animated.View>
  );
}

/* ───────────────────── Question ───────────────────── */

function Prompt({ question, feedback }: { question: Question; feedback: Feedback | null }) {
  const theme = useTheme();

  const verdict = feedback
    ? feedback.correct
      ? { label: 'Juste', color: theme.colors.success }
      : { label: 'Faux', color: theme.colors.danger }
    : null;

  return (
    <View>
      <View style={styles.promptHead}>
        <Text variant="cartouche" color={verdict ? undefined : 'textTertiary'} style={
          verdict ? { color: verdict.color } : undefined
        }>
          {verdict?.label ?? question.prompt}
        </Text>
      </View>

      {question.subject || question.emblem ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          {question.emblem ? <Text style={{ fontSize: 40 }}>{question.emblem}</Text> : null}
          {question.subject ? (
            <Text variant="display" style={{ flex: 1 }} numberOfLines={2}>
              {question.subject}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Après une erreur, on nomme explicitement la bonne réponse : la voir
          surlignée sur la carte ne suffit pas à la retenir. */}
      {feedback && !feedback.correct ? (
        <Text variant="note" color="textSecondary" style={{ marginTop: theme.space.xs }}>
          {answerLabel(feedback.question)}
        </Text>
      ) : null}
    </View>
  );
}

function answerLabel(question: Question): string {
  if (question.mode === 'choice') {
    const answer = question.choices.find((c) => c.id === question.answerId);
    return answer ? `Réponse : ${answer.label}` : '';
  }
  return `Réponse : ${question.subject}`;
}

/* ───────────────────── Propositions ───────────────────── */

type ChoiceState = 'idle' | 'correct' | 'wrong' | 'dimmed';

function ChoiceRow({
  label,
  detail,
  emblem,
  state,
  onPress,
  disabled,
}: {
  label: string;
  detail?: string;
  emblem?: string;
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
      ? { bg: theme.colors.successSoft, border: theme.colors.success, fg: theme.colors.text }
      : state === 'wrong'
        ? { bg: theme.colors.dangerSoft, border: theme.colors.danger, fg: theme.colors.text }
        : {
            bg: theme.colors.surfaceRaised,
            border: theme.colors.border,
            fg: theme.colors.text,
          };

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
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        style={{ opacity: state === 'dimmed' ? theme.opacity.disabled : 1 }}
      >
        <PaperSurface
          tone="raised"
          radius="md"
          grain={0.25}
          elevation="sheet"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            minHeight: theme.hitTarget.comfortable,
            paddingHorizontal: theme.space.lg,
            paddingVertical: theme.space.md,
            backgroundColor: palette.bg,
            borderWidth: theme.borderWidth.thin,
            borderColor: palette.border,
          }}
        >
          {emblem ? <Text style={{ fontSize: 26 }}>{emblem}</Text> : null}
          <View style={{ flex: 1 }}>
            <Text variant="label" color={palette.fg}>
              {label}
            </Text>
            {detail ? (
              <Text variant="caption" color="textTertiary">
                {detail}
              </Text>
            ) : null}
          </View>
        </PaperSurface>
      </Pressable>
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
  promptHead: { minHeight: 20, marginBottom: 4 },
  emptyStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
