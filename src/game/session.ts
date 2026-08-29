import type { AtlasId } from '@/data';
import { createRng } from './rng';
import { MAX_RUNG as MAX_RUNG_INDEX, poolAt, rungAt } from './ladder';
import { buildQuestion, parseCardId, randomQuestion, type Question, type Skill } from './questions';
import type { CardId } from './srs';

export type SessionMode = 'expedition' | 'daily' | 'lesson' | 'discovery';

export type SessionConfig = {
  mode: SessionMode;
  atlasId: AtlasId;
  skills: readonly Skill[];
  seed: number;
  questionCount: number;
  timeBank?: number;
  rung: number;
  territoryIds?: readonly string[];
  cardIds?: readonly CardId[];
  assist: number | null;
  lives?: number;
};

export type Answer = {
  cardId: string;
  chosenId: string | null;
  correct: boolean;
  elapsed: number;
  points: number;
};

export type Phase = 'asking' | 'feedback';

export type SessionState = {
  config: SessionConfig;
  questions: Question[];
  draw: (() => Question | null) | null;
  index: number;
  phase: Phase;
  last: Answer | null;
  answers: Answer[];
  score: number;
  combo: number;
  bestCombo: number;
  expiresAt: number | null;
  /** Set while a verdict is on screen: the clock does not run during it. */
  pausedAt: number | null;
  /** Set while the application is not in the foreground. */
  suspendedAt: number | null;
  askedAt: number;
  startedAt: number;
  status: 'playing' | 'finished';
  wrecks: number;
  endReason: 'completed' | 'timeout' | 'wrecked' | null;
};

export const RULES = {
  initialTimeBank: 45_000,
  timeReward: 3_400,
  timePenalty: 6_000,
  timeCap: 75_000,
  rewardDecayOver: 32,
  minRewardFactor: 0.1,
  timeRewardComboCap: 1.5,
  basePoints: 100,
  comboTiers: [
    { streak: 0, multiplier: 1 },
    { streak: 3, multiplier: 1.25 },
    { streak: 6, multiplier: 1.5 },
    { streak: 10, multiplier: 2 },
    { streak: 15, multiplier: 3 },
  ],
  fastAnswerMs: 1_500,
  slowAnswerMs: 8_000,
  maxSpeedBonus: 0.6,
  lives: 6,
} as const;

export const PREFETCH = 8;

const LOOKAHEAD = 3;

export function rewardDecay(answered: number): number {
  const t = Math.min(1, answered / RULES.rewardDecayOver);
  return RULES.minRewardFactor + (1 - RULES.minRewardFactor) * (1 - t);
}

export function comboMultiplier(streak: number): number {
  let multiplier = 1;
  for (const tier of RULES.comboTiers) if (streak >= tier.streak) multiplier = tier.multiplier;
  return multiplier;
}

export function speedBonus(elapsed: number): number {
  if (elapsed <= RULES.fastAnswerMs) return RULES.maxSpeedBonus;
  if (elapsed >= RULES.slowAnswerMs) return 0;
  const span = RULES.slowAnswerMs - RULES.fastAnswerMs;
  return RULES.maxSpeedBonus * (1 - (elapsed - RULES.fastAnswerMs) / span);
}

export function pointsFor(elapsed: number, streak: number): number {
  return Math.round(RULES.basePoints * comboMultiplier(streak) * (1 + speedBonus(elapsed)));
}

type Queue = { questions: Question[]; draw: (() => Question | null) | null };

function fixedQueue(config: SessionConfig): Question[] {
  const rng = createRng(config.seed);
  const questions: Question[] = [];

  for (const cardId of config.cardIds!) {
    const parsed = parseCardId(cardId);
    if (!parsed) continue;
    const question = buildQuestion(config.atlasId, parsed.territoryId, parsed.skill, rng);
    if (question) questions.push(question);
  }
  return questions;
}

function buildQueue(config: SessionConfig): Queue {
  if (config.cardIds) return { questions: fixedQueue(config), draw: null };

  const rng = createRng(config.seed);
  const pool = config.territoryIds
    ? config.territoryIds.map((id) => ({ id }))
    : poolAt(config.atlasId, config.rung);

  const seen = new Set<string>();
  let produced = 0;

  const draw = (): Question | null => {
    if (produced >= config.questionCount) return null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const question = randomQuestion(config.atlasId, rng, config.skills, pool);
      if (!question || seen.has(question.cardId)) continue;
      seen.add(question.cardId);
      produced++;
      return question;
    }
    return null;
  };

  /*
   * A short session is built in one go — ten questions cost nothing. Only the
   * open-ended expedition draws lazily, so that pressing "Jouer" never pays for
   * three hundred questions the player will not reach.
   */
  const questions: Question[] = [];
  const upfront = config.questionCount > PREFETCH * 3 ? PREFETCH : config.questionCount;
  for (let i = 0; i < upfront; i++) {
    const question = draw();
    if (!question) break;
    questions.push(question);
  }

  return { questions, draw: questions.length < config.questionCount ? draw : null };
}

function topUp(state: SessionState): SessionState {
  if (!state.draw) return state;
  if (state.questions.length > state.index + LOOKAHEAD) return state;

  const questions = state.questions.slice();
  let draw: SessionState['draw'] = state.draw;

  while (questions.length <= state.index + LOOKAHEAD) {
    const question = draw();
    if (!question) {
      draw = null;
      break;
    }
    questions.push(question);
  }

  return { ...state, questions, draw };
}

export function startSession(config: SessionConfig, now: number): SessionState {
  const { questions, draw } = buildQueue(config);
  return {
    config,
    questions,
    draw,
    index: 0,
    phase: 'asking',
    last: null,
    answers: [],
    score: 0,
    combo: 0,
    bestCombo: 0,
    wrecks: 0,
    expiresAt: config.timeBank ? now + config.timeBank : null,
    pausedAt: null,
    suspendedAt: null,
    askedAt: now,
    startedAt: now,
    status: questions.length > 0 ? 'playing' : 'finished',
    endReason: questions.length > 0 ? null : 'completed',
  };
}

export const currentQuestion = (state: SessionState): Question | null =>
  state.questions[state.index] ?? null;

export const questionTotal = (state: SessionState): number | null =>
  state.config.mode === 'expedition' ? null : state.config.questionCount;

/** What the hourglass shows: frozen during a verdict, and during an absence. */
export const timeRemaining = (state: SessionState, now: number): number => {
  if (state.expiresAt === null) return Infinity;
  const reference = state.pausedAt ?? state.suspendedAt ?? now;
  return Math.max(0, state.expiresAt - reference);
};

export function answer(state: SessionState, chosenId: string | null, now: number): SessionState {
  if (state.status !== 'playing' || state.phase !== 'asking') return state;

  const question = currentQuestion(state);
  if (!question) return finish(state, 'completed');

  const elapsed = Math.max(0, now - state.askedAt);
  const correct = chosenId !== null && chosenId === question.answerId;
  const points = correct ? pointsFor(elapsed, state.combo) : 0;
  const combo = correct ? state.combo + 1 : 0;

  const record: Answer = {
    cardId: question.cardId,
    chosenId,
    correct,
    elapsed,
    points,
  };

  let expiresAt = state.expiresAt;
  if (expiresAt !== null) {
    const delta = correct
      ? RULES.timeReward *
        Math.min(RULES.timeRewardComboCap, comboMultiplier(state.combo)) *
        rewardDecay(state.answers.length)
      : -RULES.timePenalty;
    expiresAt = Math.min(now + RULES.timeCap, Math.max(now, expiresAt + delta));
  }

  const wrecks = state.wrecks + (correct ? 0 : 1);

  const next = topUp({
    ...state,
    answers: [...state.answers, record],
    score: state.score + points,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    wrecks,
    expiresAt,
    pausedAt: expiresAt === null ? null : now,
    phase: 'feedback',
    last: record,
  });

  if (state.config.lives !== undefined && wrecks >= state.config.lives) {
    return finish(next, 'wrecked');
  }
  if (expiresAt !== null && expiresAt <= now) return finish(next, 'timeout');
  if (next.index + 1 >= next.questions.length) return finish(next, 'completed');
  return next;
}

export function advance(state: SessionState, now: number): SessionState {
  if (state.status !== 'playing' || state.phase !== 'feedback') return state;

  return topUp({
    ...resume(state, now),
    index: state.index + 1,
    phase: 'asking',
    last: null,
    askedAt: now,
  });
}

function resume(state: SessionState, now: number): SessionState {
  if (state.expiresAt === null || state.pausedAt === null) return { ...state, pausedAt: null };
  return { ...state, expiresAt: state.expiresAt + (now - state.pausedAt), pausedAt: null };
}

export function mend(state: SessionState, now: number): SessionState {
  const last = state.answers.at(-1);
  if (!last || last.correct) return state;

  return {
    ...resume(state, now),
    answers: state.answers.slice(0, -1),
    score: state.score - last.points,
    wrecks: Math.max(0, state.wrecks - 1),
    phase: 'asking',
    last: null,
    askedAt: now,
    status: 'playing',
    endReason: null,
  };
}

export function expire(state: SessionState, now: number): SessionState {
  if (state.status !== 'playing') return state;
  if (state.expiresAt === null) return state;
  if (state.pausedAt !== null || state.suspendedAt !== null) return state;
  if (state.expiresAt > now) return state;
  return finish(state, 'timeout');
}

/**
 * The player left — the application went to the background, or was closed.
 * Nothing about a session should keep running while nobody is looking at it:
 * not the time bank, not the answer clock, not the duration of the game.
 */
export function suspend(state: SessionState, now: number): SessionState {
  if (state.status !== 'playing' || state.suspendedAt !== null) return state;
  return { ...state, suspendedAt: now };
}

/** The player is back. Every clock is shifted by exactly the time they were away. */
export function wake(state: SessionState, now: number): SessionState {
  if (state.suspendedAt === null) return state;
  const away = Math.max(0, now - state.suspendedAt);

  return {
    ...state,
    suspendedAt: null,
    askedAt: state.askedAt + away,
    startedAt: state.startedAt + away,
    expiresAt: state.expiresAt === null ? null : state.expiresAt + away,
    pausedAt: state.pausedAt === null ? null : state.pausedAt + away,
  };
}

function finish(state: SessionState, reason: 'completed' | 'timeout' | 'wrecked'): SessionState {
  return { ...state, status: 'finished', endReason: reason };
}

export type SessionSummary = {
  score: number;
  asked: number;
  correct: number;
  accuracy: number;
  bestCombo: number;
  duration: number;
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

export function emojiSummary(state: SessionState, dateLabel: string): string {
  const grid = state.answers.map((a) => (a.correct ? '🟩' : '🟥')).join('');
  const correct = state.answers.filter((a) => a.correct).length;
  return [
    `Portulan — Relevé du ${dateLabel}`,
    `${correct}/${state.answers.length} · ${state.score} pts`,
    grid,
  ].join('\n');
}

export const DAILY_QUESTION_COUNT = 10;
export const DISCOVERY_BATCH = 5;

export function expeditionConfig(atlasId: AtlasId, seed: number, rung: number): SessionConfig {
  const step = rungAt(atlasId, rung);
  return {
    mode: 'expedition',
    atlasId,
    skills: step.skills,
    seed,
    questionCount: 300,
    timeBank: RULES.initialTimeBank,
    rung: step.index,
    assist: step.assist,
    lives: RULES.lives,
  };
}

export function dailyConfig(atlasId: AtlasId, seed: number): SessionConfig {
  const step = rungAt(atlasId, MAX_RUNG_INDEX);
  return {
    mode: 'daily',
    atlasId,
    skills: step.skills,
    seed,
    questionCount: DAILY_QUESTION_COUNT,
    rung: step.index,
    assist: step.assist,
  };
}

export function lessonConfig(
  atlasId: AtlasId,
  seed: number,
  rung: number,
  cardIds: readonly CardId[],
): SessionConfig {
  const step = rungAt(atlasId, rung);
  return {
    mode: 'lesson',
    atlasId,
    skills: step.skills,
    seed,
    questionCount: cardIds.length,
    rung: step.index,
    cardIds,
    assist: step.assist,
  };
}

export function discoveryConfig(
  atlasId: AtlasId,
  seed: number,
  rung: number,
  territoryIds: readonly string[],
): SessionConfig {
  const step = rungAt(atlasId, rung);
  return {
    mode: 'discovery',
    atlasId,
    skills: step.skills.slice(0, 2),
    seed,
    questionCount: territoryIds.length * 2,
    rung: step.index,
    territoryIds,
    assist: step.assist,
  };
}
