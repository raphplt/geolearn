import type { AtlasId } from '@/data';
import type { Territory } from '@/data/types';
import { difficultyTable } from './difficulty';
import { parseCardId, type Skill } from './questions';
import type { Card, CardId } from './srs';

export type Rung = {
  index: number;
  name: string;
  motto: string;
  share: number;
  skills: readonly Skill[];
  assist: number | null;
};

const FRANCE_LADDER: Rung[] = [
  {
    index: 0,
    name: 'Cabotage',
    motto: 'Les quinze départements les plus connus, à reconnaître sur la carte.',
    share: 0.15,
    skills: ['name', 'locate'],
    assist: 0.34,
  },
  {
    index: 1,
    name: 'Petit large',
    motto: 'Trente départements, et leurs chefs-lieux.',
    share: 0.3,
    skills: ['name', 'locate', 'prefecture'],
    assist: 0.5,
  },
  {
    index: 2,
    name: 'Haute mer',
    motto: 'La moitié de la France, numéros compris.',
    share: 0.55,
    skills: ['name', 'locate', 'prefecture', 'code'],
    assist: 0.72,
  },
  {
    index: 3,
    name: 'Grand large',
    motto: 'Quatre-vingts départements, et les questions à rebours.',
    share: 0.8,
    skills: ['name', 'locate', 'prefecture', 'code', 'prefectureToDept'],
    assist: null,
  },
  {
    index: 4,
    name: 'Circumnavigation',
    motto: 'Les 101 départements, sans aucune aide.',
    share: 1,
    skills: ['name', 'locate', 'prefecture', 'code', 'prefectureToDept'],
    assist: null,
  },
];

const WORLD_LADDER: Rung[] = [
  {
    index: 0,
    name: 'Cabotage',
    motto: 'Les vingt-cinq pays les plus peuplés, par leur drapeau et leur nom.',
    share: 0.15,
    skills: ['flag', 'name'],
    assist: 0.34,
  },
  {
    index: 1,
    name: 'Petit large',
    motto: 'Cinquante pays, à situer sur le planisphère.',
    share: 0.3,
    skills: ['flag', 'name', 'locate'],
    assist: 0.5,
  },
  {
    index: 2,
    name: 'Haute mer',
    motto: 'La moitié du monde, capitales comprises.',
    share: 0.55,
    skills: ['flag', 'name', 'locate', 'capital'],
    assist: 0.72,
  },
  {
    index: 3,
    name: 'Grand large',
    motto: 'Cent trente pays, et les questions à rebours.',
    share: 0.8,
    skills: ['flag', 'name', 'locate', 'capital', 'capitalToCountry'],
    assist: null,
  },
  {
    index: 4,
    name: 'Circumnavigation',
    motto: 'Tous les États membres, sans aucune aide.',
    share: 1,
    skills: ['flag', 'name', 'locate', 'capital', 'capitalToCountry'],
    assist: null,
  },
];

export const LADDERS: Record<AtlasId, Rung[]> = {
  'france-departments': FRANCE_LADDER,
  'world-countries': WORLD_LADDER,
};

export const MAX_RUNG = FRANCE_LADDER.length - 1;

const PROMOTION_LEVEL = 2;

const PROMOTION_SHARE = 0.6;

export const rungsOf = (atlasId: AtlasId): Rung[] => LADDERS[atlasId];

export function poolAt(atlasId: AtlasId, rungIndex: number): Territory[] {
  const rungs = rungsOf(atlasId);
  const rung = rungs[Math.min(Math.max(0, rungIndex), rungs.length - 1)]!;
  const { ordered } = difficultyTable(atlasId);
  const count = Math.max(8, Math.round(ordered.length * rung.share));
  return ordered.slice(0, Math.min(count, ordered.length));
}

export function rungAt(atlasId: AtlasId, rungIndex: number): Rung {
  const rungs = rungsOf(atlasId);
  return rungs[Math.min(Math.max(0, rungIndex), rungs.length - 1)]!;
}

export function earnedRung(atlasId: AtlasId, cards: Readonly<Record<CardId, Card>>): number {
  const levels = new Map<string, number>();
  for (const [cardId, card] of Object.entries(cards)) {
    const parsed = parseCardId(cardId);
    if (!parsed || parsed.atlasId !== atlasId) continue;
    const current = levels.get(parsed.territoryId);
    levels.set(
      parsed.territoryId,
      current === undefined ? card.level : Math.min(current, card.level),
    );
  }

  let rung = 0;
  while (rung < MAX_RUNG) {
    const pool = poolAt(atlasId, rung);
    const known = pool.filter((t) => (levels.get(t.id) ?? 0) >= PROMOTION_LEVEL).length;
    if (known / pool.length < PROMOTION_SHARE) break;
    rung++;
  }
  return rung;
}

export const currentRung = (
  atlasId: AtlasId,
  cards: Readonly<Record<CardId, Card>>,
  floor: number,
): number => Math.min(MAX_RUNG, Math.max(earnedRung(atlasId, cards), Math.max(0, floor)));

export function rungProgress(
  atlasId: AtlasId,
  cards: Readonly<Record<CardId, Card>>,
  rungIndex: number,
): { known: number; needed: number; ratio: number } {
  const levels = new Map<string, number>();
  for (const [cardId, card] of Object.entries(cards)) {
    const parsed = parseCardId(cardId);
    if (!parsed || parsed.atlasId !== atlasId) continue;
    const current = levels.get(parsed.territoryId);
    levels.set(
      parsed.territoryId,
      current === undefined ? card.level : Math.min(current, card.level),
    );
  }

  const pool = poolAt(atlasId, rungIndex);
  const known = pool.filter((t) => (levels.get(t.id) ?? 0) >= PROMOTION_LEVEL).length;
  const needed = Math.ceil(pool.length * PROMOTION_SHARE);
  return { known, needed, ratio: needed === 0 ? 1 : Math.min(1, known / needed) };
}

export function undiscovered(
  atlasId: AtlasId,
  cards: Readonly<Record<CardId, Card>>,
  rungIndex: number,
): Territory[] {
  const seen = new Set<string>();
  for (const cardId of Object.keys(cards)) {
    const parsed = parseCardId(cardId);
    if (parsed && parsed.atlasId === atlasId) seen.add(parsed.territoryId);
  }

  const pool = poolAt(atlasId, rungIndex).filter((t) => !seen.has(t.id));
  if (rungIndex === 0) return pool;

  const previous = new Set(poolAt(atlasId, rungIndex - 1).map((t) => t.id));
  const opened = pool.filter((t) => !previous.has(t.id));
  const older = pool.filter((t) => previous.has(t.id));
  return [...opened, ...older];
}
