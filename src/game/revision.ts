import type { AtlasId } from '@/data';
import { parseCardId, type Skill } from './questions';
import { isDue, reviewPriority, type Card, type CardId } from './srs';

export type DueCard = {
  cardId: CardId;
  territoryId: string;
  skill: Skill;
  overdue: number;
  level: number;
  lapses: number;
};

export function dueQueue(
  cards: Readonly<Record<CardId, Card>>,
  atlasId: AtlasId,
  now: number,
  limit = Number.POSITIVE_INFINITY,
): DueCard[] {
  const due: { card: DueCard; priority: number }[] = [];

  for (const [cardId, card] of Object.entries(cards)) {
    const parsed = parseCardId(cardId);
    if (!parsed || parsed.atlasId !== atlasId) continue;
    if (!isDue(card, now)) continue;

    due.push({
      priority: reviewPriority(card, now),
      card: {
        cardId,
        territoryId: parsed.territoryId,
        skill: parsed.skill,
        overdue: now - card.due,
        level: card.level,
        lapses: card.lapses,
      },
    });
  }

  due.sort((a, b) => b.priority - a.priority || a.card.cardId.localeCompare(b.card.cardId));

  return due.slice(0, limit === Number.POSITIVE_INFINITY ? undefined : limit).map((d) => d.card);
}

export function dueCount(
  cards: Readonly<Record<CardId, Card>>,
  atlasId: AtlasId,
  now: number,
): number {
  let count = 0;
  for (const [cardId, card] of Object.entries(cards)) {
    const parsed = parseCardId(cardId);
    if (parsed && parsed.atlasId === atlasId && isDue(card, now)) count++;
  }
  return count;
}

export const REVISION_BATCH = 12;
