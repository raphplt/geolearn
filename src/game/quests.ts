import { createRng } from './rng';
import type { SessionMode, SessionSummary } from './session';
import type { LearningDelta } from './economy';

export type QuestKind = 'correct' | 'combo' | 'mastery' | 'promotion' | 'sessions' | 'score';

export type QuestTemplate = {
  kind: QuestKind;
  targets: readonly number[];
  label: (target: number) => string;
  reward: number;
};

const TEMPLATES: readonly QuestTemplate[] = [
  {
    kind: 'correct',
    targets: [15, 25, 40],
    label: (n) => `Répondre juste à ${n} questions`,
    reward: 20,
  },
  {
    kind: 'combo',
    targets: [6, 10, 15],
    label: (n) => `Enchaîner ${n} bonnes réponses d’affilée`,
    reward: 25,
  },
  {
    kind: 'mastery',
    targets: [1, 2, 3],
    label: (n) => `Faire entrer ${n} territoire${n > 1 ? 's' : ''} en mémoire longue`,
    reward: 35,
  },
  {
    kind: 'promotion',
    targets: [8, 14, 20],
    label: (n) => `Promouvoir ${n} cartes d’une boîte`,
    reward: 25,
  },
  {
    kind: 'sessions',
    targets: [2, 3, 4],
    label: (n) => `Terminer ${n} parties`,
    reward: 20,
  },
  {
    kind: 'score',
    targets: [1_200, 2_000, 3_000],
    label: (n) => `Atteindre ${n} points en une expédition`,
    reward: 30,
  },
];

export const CARNET_BONUS = 60;

export const QUESTS_PER_DAY = 3;

export type Quest = {
  id: string;
  kind: QuestKind;
  label: string;
  target: number;
  progress: number;
  reward: number;
};

export function questsFor(dateKey: string, progress: Record<string, number> = {}): Quest[] {
  const rng = createRng(seedOf(dateKey));
  const pool = [...TEMPLATES];
  const quests: Quest[] = [];

  for (let i = 0; i < QUESTS_PER_DAY && pool.length > 0; i++) {
    const [template] = pool.splice(Math.floor(rng() * pool.length), 1);
    if (!template) break;
    const target = template.targets[Math.floor(rng() * template.targets.length)]!;
    const id = `${template.kind}:${target}`;
    quests.push({
      id,
      kind: template.kind,
      label: template.label(target),
      target,
      progress: Math.min(progress[id] ?? 0, target),
      reward: template.reward,
    });
  }

  return quests;
}

function seedOf(dateKey: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export function questDelta(
  mode: SessionMode,
  summary: SessionSummary,
  learning: LearningDelta,
): { increments: Partial<Record<QuestKind, number>>; maxima: Partial<Record<QuestKind, number>> } {
  return {
    increments: {
      correct: summary.correct,
      mastery: learning.masteries,
      promotion: learning.promotions,
      sessions: summary.asked > 0 ? 1 : 0,
    },
    maxima: {
      combo: summary.bestCombo,
      score: mode === 'expedition' ? summary.score : 0,
    },
  };
}

export function applyQuestProgress(
  current: Record<string, number>,
  dateKey: string,
  delta: ReturnType<typeof questDelta>,
): Record<string, number> {
  const next = { ...current };

  for (const quest of questsFor(dateKey)) {
    const increment = delta.increments[quest.kind];
    if (increment) {
      next[quest.id] = Math.min(quest.target, (next[quest.id] ?? 0) + increment);
    }
    const maximum = delta.maxima[quest.kind];
    if (maximum) {
      next[quest.id] = Math.min(quest.target, Math.max(next[quest.id] ?? 0, maximum));
    }
  }

  return next;
}

export const isComplete = (quest: Quest): boolean => quest.progress >= quest.target;

export function carnetPayout(
  quests: Quest[],
  alreadyPaid: number,
): { doublons: number; completed: number } {
  const completed = quests.filter(isComplete).length;
  if (completed <= alreadyPaid) return { doublons: 0, completed };

  let doublons = 0;
  const done = quests.filter(isComplete);
  for (let i = alreadyPaid; i < completed; i++) doublons += done[i]!.reward;

  if (completed === quests.length && alreadyPaid < quests.length) doublons += CARNET_BONUS;

  return { doublons, completed };
}
