
export type CardId = string;

export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type Card = {
  id: CardId;
  level: MasteryLevel;
  due: number;
  reviews: number;
  lapses: number;
  lastReviewed: number;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const INTERVALS: readonly number[] = [
  10 * MINUTE,
  1 * DAY,
  3 * DAY,
  8 * DAY,
  21 * DAY,
  60 * DAY,
];

export const MAX_LEVEL: MasteryLevel = 5;

export const MASTERED_LEVEL: MasteryLevel = 3;

export function createCard(id: CardId, now: number): Card {
  return { id, level: 0, due: now, reviews: 0, lapses: 0, lastReviewed: 0 };
}

export type ReviewOutcome = {
  correct: boolean;
  elapsed?: number;
};

const HESITATION_MS = 6_000;

export function review(card: Card, outcome: ReviewOutcome, now: number): Card {
  const reviews = card.reviews + 1;

  if (!outcome.correct) {
    const lapsed = card.level >= MASTERED_LEVEL;
    return {
      ...card,
      level: 0,
      due: now + INTERVALS[0]!,
      reviews,
      lapses: card.lapses + (lapsed ? 1 : 0),
      lastReviewed: now,
    };
  }

  const hesitant = (outcome.elapsed ?? 0) > HESITATION_MS;
  const nextLevel = Math.min(
    MAX_LEVEL,
    card.level + (hesitant && card.level > 0 ? 0 : 1),
  ) as MasteryLevel;

  return {
    ...card,
    level: nextLevel,
    due: now + INTERVALS[Math.min(nextLevel, INTERVALS.length - 1)]!,
    reviews,
    lastReviewed: now,
  };
}

export const isDue = (card: Card, now: number): boolean => card.due <= now;

export const isMastered = (card: Card): boolean => card.level >= MASTERED_LEVEL;

export function reviewPriority(card: Card, now: number): number {
  if (isDue(card, now)) {
    const overdue = now - card.due;
    return 1_000_000 + overdue / 1000 + card.lapses * 50_000;
  }
  if (card.reviews === 0) return 500_000;
  return Math.max(0, 100_000 - (card.due - now) / 1000);
}
