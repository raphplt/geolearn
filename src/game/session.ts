/**
 * Moteur de partie — réducteur pur, sans React ni horloge propre.
 *
 * Deux principes de conception :
 *
 * 1. **Aucun état dérivé du temps n'est stocké.** On mémorise une échéance
 *    (`expiresAt`), jamais un « temps restant » qu'il faudrait décrémenter.
 *    Un compte à rebours conservé dans l'état imposerait un rendu par tick,
 *    dériverait à chaque mise en veille de l'application, et rendrait la partie
 *    irreproductible. L'interface anime la jauge à partir de l'échéance ; le
 *    moteur, lui, se contente de comparer des dates.
 *
 * 2. **La file de questions est tirée d'avance**, à partir d'une graine. L'état
 *    reste donc entièrement sérialisable et une partie est rejouable à
 *    l'identique — ce dont dépendra le duel asynchrone de la v2, où l'on
 *    transmettra une graine plutôt qu'une liste de questions.
 */
import type { AtlasId } from '@/data';
import { createRng } from './rng';
import { randomQuestion, SKILLS_BY_ATLAS, type Question, type Skill } from './questions';

export type SessionMode =
  /** Course sans fin : la réserve de temps s'épuise, les bonnes réponses la rechargent. */
  | 'expedition'
  /** Relevé quotidien : série fixe, identique pour tous, une fois par jour. */
  | 'daily'
  /** Leçon : révision des cartes échues, sans pression de temps. */
  | 'lesson';

export type SessionConfig = {
  mode: SessionMode;
  atlasId: AtlasId;
  skills: readonly Skill[];
  seed: number;
  /** Nombre de questions. Pour l'expédition, c'est un plafond de sécurité. */
  questionCount: number;
  /** Réserve de temps initiale, en millisecondes. Absente pour les modes sans chrono. */
  timeBank?: number;
};

export type Answer = {
  questionId: string;
  cardId: string;
  /** Identifiant choisi — `null` si le temps a manqué. */
  chosenId: string | null;
  correct: boolean;
  /** Temps de réflexion, en millisecondes. */
  elapsed: number;
  /** Points marqués, multiplicateur inclus. */
  points: number;
};

export type SessionState = {
  config: SessionConfig;
  questions: Question[];
  /** Index de la question en cours dans `questions`. */
  index: number;
  answers: Answer[];
  score: number;
  /** Série de bonnes réponses consécutives. */
  combo: number;
  bestCombo: number;
  /** Échéance de la réserve de temps. `null` pour les modes sans chrono. */
  expiresAt: number | null;
  /** Instant d'affichage de la question courante, pour mesurer le temps de réponse. */
  askedAt: number;
  startedAt: number;
  status: 'playing' | 'finished';
  /** Renseigné à la fin : pourquoi la partie s'est arrêtée. */
  endReason: 'completed' | 'timeout' | null;
};

/* ───────────────────────── Réglages ───────────────────────── */

export const RULES = {
  /** Réserve initiale de l'expédition. Assez pour trois ou quatre questions sereines. */
  initialTimeBank: 45_000,
  /** Temps rendu par bonne réponse, avant multiplicateur de série. */
  timeReward: 3_400,
  /** Temps retiré par erreur. Nettement supérieur au gain : l'erreur doit coûter. */
  timePenalty: 6_000,
  /** Plafond de la réserve : sans lui, un bon joueur accumulerait une avance inrattrapable. */
  timeCap: 75_000,
  /**
   * Érosion de la récompense en temps au fil de la partie.
   *
   * Sans elle, l'expédition n'a pas de fin : un joueur qui répond juste en une
   * seconde regagne plus de temps qu'il n'en consomme, et la partie ne s'arrête
   * que sur le plafond de questions — un arrêt arbitraire, qui n'est ni une
   * victoire ni une défaite. En faisant fondre la récompense pendant que la
   * pénalité reste constante, on installe une montée de pression : la partie
   * finit toujours par se refermer, mais tard, et sur une erreur du joueur.
   */
  rewardDecayOver: 32,
  minRewardFactor: 0.1,
  /** Plafond du multiplicateur appliqué au *temps* — distinct de celui des points. */
  timeRewardComboCap: 1.5,
  basePoints: 100,
  /** Paliers de série et multiplicateurs associés. */
  comboTiers: [
    { streak: 0, multiplier: 1 },
    { streak: 3, multiplier: 1.25 },
    { streak: 6, multiplier: 1.5 },
    { streak: 10, multiplier: 2 },
    { streak: 15, multiplier: 3 },
  ],
  /** En deçà, la réponse est jugée immédiate et vaut le bonus de vitesse maximal. */
  fastAnswerMs: 1_500,
  /** Au-delà, plus aucun bonus de vitesse. */
  slowAnswerMs: 8_000,
  maxSpeedBonus: 0.6,
} as const;

/**
 * Facteur d'érosion de la récompense en temps, après `answered` réponses.
 *
 * Décroît linéairement de 1 à `minRewardFactor`, puis reste constant.
 */
export function rewardDecay(answered: number): number {
  const t = Math.min(1, answered / RULES.rewardDecayOver);
  /* Interpolation écrite depuis le plancher : `1 - t * (1 - min)` donnerait
     0.30000000000000004 au lieu de 0.3 en bout de course, et la valeur
     n'atteindrait jamais exactement sa borne. */
  return RULES.minRewardFactor + (1 - RULES.minRewardFactor) * (1 - t);
}

export function comboMultiplier(streak: number): number {
  let multiplier = 1;
  for (const tier of RULES.comboTiers) if (streak >= tier.streak) multiplier = tier.multiplier;
  return multiplier;
}

/**
 * Bonus de vitesse, décroissant linéairement entre les deux seuils.
 *
 * Il récompense la connaissance immédiate plutôt que la reconstruction par
 * élimination — c'est ce qui distingue « je sais » de « j'ai trouvé ».
 */
export function speedBonus(elapsed: number): number {
  if (elapsed <= RULES.fastAnswerMs) return RULES.maxSpeedBonus;
  if (elapsed >= RULES.slowAnswerMs) return 0;
  const span = RULES.slowAnswerMs - RULES.fastAnswerMs;
  return RULES.maxSpeedBonus * (1 - (elapsed - RULES.fastAnswerMs) / span);
}

export function pointsFor(elapsed: number, streak: number): number {
  return Math.round(RULES.basePoints * comboMultiplier(streak) * (1 + speedBonus(elapsed)));
}

/* ───────────────────────── Cycle de vie ───────────────────────── */

/** Tire la file de questions d'une partie, en écartant les doublons consécutifs. */
function buildQueue(config: SessionConfig): Question[] {
  const rng = createRng(config.seed);
  const questions: Question[] = [];
  const seen = new Set<string>();

  /* On tolère un large excédent de tentatives : une compétence peut ne pas
     s'appliquer à un territoire, et l'on veut éviter de reposer deux fois la
     même carte dans une même partie tant qu'il reste du matériel neuf. */
  for (let attempt = 0; attempt < config.questionCount * 12; attempt++) {
    if (questions.length >= config.questionCount) break;
    const question = randomQuestion(config.atlasId, rng, config.skills);
    if (!question) continue;
    if (seen.has(question.cardId)) continue;
    seen.add(question.cardId);
    questions.push(question);
  }

  return questions;
}

export function startSession(config: SessionConfig, now: number): SessionState {
  const questions = buildQueue(config);
  return {
    config,
    questions,
    index: 0,
    answers: [],
    score: 0,
    combo: 0,
    bestCombo: 0,
    expiresAt: config.timeBank ? now + config.timeBank : null,
    askedAt: now,
    startedAt: now,
    status: questions.length > 0 ? 'playing' : 'finished',
    endReason: questions.length > 0 ? null : 'completed',
  };
}

export const currentQuestion = (state: SessionState): Question | null =>
  state.questions[state.index] ?? null;

export const timeRemaining = (state: SessionState, now: number): number =>
  state.expiresAt === null ? Infinity : Math.max(0, state.expiresAt - now);

/**
 * Enregistre une réponse et fait avancer la partie.
 *
 * `chosenId` à `null` signifie que le joueur n'a pas répondu — abandon de la
 * question ou expiration. C'est traité comme une erreur, mais sans en tirer de
 * bonus de vitesse.
 */
export function answer(state: SessionState, chosenId: string | null, now: number): SessionState {
  if (state.status !== 'playing') return state;

  const question = currentQuestion(state);
  if (!question) return finish(state, 'completed');

  const elapsed = Math.max(0, now - state.askedAt);
  const correct = chosenId !== null && chosenId === question.answerId;
  const points = correct ? pointsFor(elapsed, state.combo) : 0;
  const combo = correct ? state.combo + 1 : 0;

  const record: Answer = {
    questionId: question.id,
    cardId: question.cardId,
    chosenId,
    correct,
    elapsed,
    points,
  };

  let expiresAt = state.expiresAt;
  if (expiresAt !== null) {
    /* La récompense en temps suit la série, la pénalité non : accélérer doit se
       mériter, ralentir doit se subir de la même façon pour tous. */
    const delta = correct
      ? RULES.timeReward *
        Math.min(RULES.timeRewardComboCap, comboMultiplier(state.combo)) *
        rewardDecay(state.answers.length)
      : -RULES.timePenalty;
    expiresAt = Math.min(now + RULES.timeCap, Math.max(now, expiresAt + delta));
  }

  const next: SessionState = {
    ...state,
    answers: [...state.answers, record],
    score: state.score + points,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    expiresAt,
    index: state.index + 1,
    askedAt: now,
  };

  if (expiresAt !== null && expiresAt <= now) return finish(next, 'timeout');
  if (next.index >= next.questions.length) return finish(next, 'completed');
  return next;
}

/** Constate l'expiration de la réserve de temps. Appelé par l'interface quand la jauge atteint zéro. */
export function expire(state: SessionState, now: number): SessionState {
  if (state.status !== 'playing') return state;
  if (state.expiresAt === null || state.expiresAt > now) return state;
  return finish(state, 'timeout');
}

function finish(state: SessionState, reason: 'completed' | 'timeout'): SessionState {
  return { ...state, status: 'finished', endReason: reason };
}

/* ───────────────────────── Bilan ───────────────────────── */

export type SessionSummary = {
  score: number;
  asked: number;
  correct: number;
  accuracy: number;
  bestCombo: number;
  /** Durée totale de la partie, en millisecondes. */
  duration: number;
  /** Temps de réponse médian — plus robuste que la moyenne, qu'une seule hésitation fausse. */
  medianElapsed: number;
};

export function summarize(state: SessionState, now: number): SessionSummary {
  const asked = state.answers.length;
  const correct = state.answers.filter((a) => a.correct).length;
  const times = state.answers.map((a) => a.elapsed).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const medianElapsed =
    times.length === 0
      ? 0
      : times.length % 2 === 1
        ? times[middle]!
        : ((times[middle - 1] ?? 0) + (times[middle] ?? 0)) / 2;

  return {
    score: state.score,
    asked,
    correct,
    accuracy: asked === 0 ? 0 : correct / asked,
    bestCombo: state.bestCombo,
    duration: Math.max(0, now - state.startedAt),
    medianElapsed,
  };
}

/**
 * Résumé en émojis du relevé quotidien, à partager.
 *
 * Le format est celui qu'a popularisé Wordle : une grille qui dit tout du
 * résultat sans rien divulguer des réponses. C'est le seul vecteur de diffusion
 * d'une application sans compte ni réseau social intégré.
 */
export function emojiSummary(state: SessionState, dateLabel: string): string {
  const grid = state.answers.map((a) => (a.correct ? '🟩' : '🟥')).join('');
  const correct = state.answers.filter((a) => a.correct).length;
  return [
    `Portulan — Relevé du ${dateLabel}`,
    `${correct}/${state.answers.length} · ${state.score} pts`,
    grid,
  ].join('\n');
}

/* ───────────────────────── Préréglages ───────────────────────── */

export const DAILY_QUESTION_COUNT = 10;

export function expeditionConfig(atlasId: AtlasId, seed: number): SessionConfig {
  return {
    mode: 'expedition',
    atlasId,
    skills: SKILLS_BY_ATLAS[atlasId],
    seed,
    /* Filet de sécurité, non objectif : l'érosion de la récompense fait que la
       réserve s'épuise bien avant qu'on approche ce nombre. */
    questionCount: 300,
    timeBank: RULES.initialTimeBank,
  };
}

export function dailyConfig(atlasId: AtlasId, seed: number): SessionConfig {
  return {
    mode: 'daily',
    atlasId,
    skills: SKILLS_BY_ATLAS[atlasId],
    seed,
    questionCount: DAILY_QUESTION_COUNT,
  };
}
