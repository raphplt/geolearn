import { ATLASES, type AtlasId } from '@/data';
import { cartouchesOf, masteryOf } from './mastery';
import { MASTERED_LEVEL, MAX_LEVEL, type Card, type CardId } from './srs';
import { MAX_RANK, rankFor } from './economy';
import { currentRung, MAX_RUNG } from './ladder';
import { parseCardId } from './questions';

export type BrevetTier = 'cuivre' | 'argent' | 'or';

export type Brevet = {
  id: string;
  name: string;
  detail: string;
  tier: BrevetTier;
  reward: number;
};

export type BrevetContext = {
  cards: Readonly<Record<CardId, Card>>;
  xp: number;
  longestStreak: number;
  bestExpedition: number;
  floor: number;
  bestCombo: number;
};

type Rule = Brevet & { earned: (context: BrevetContext) => boolean };

const seenIn = (cards: BrevetContext['cards'], atlasId: AtlasId): number => {
  const seen = new Set<string>();
  for (const cardId of Object.keys(cards)) {
    const parsed = parseCardId(cardId);
    if (parsed && parsed.atlasId === atlasId) seen.add(parsed.territoryId);
  }
  return seen.size;
};

const masteredIn = (cards: BrevetContext['cards'], atlasId: AtlasId): number =>
  masteryOf(cards, atlasId, ATLASES[atlasId]).mastered;

const sealsIn = (cards: BrevetContext['cards'], atlasId: AtlasId): number =>
  cartouchesOf(masteryOf(cards, atlasId, ATLASES[atlasId]), atlasId, ATLASES[atlasId]).filter(
    (c) => c.sealed,
  ).length;

const atMaxBox = (cards: BrevetContext['cards']): number =>
  Object.values(cards).filter((card) => card.level >= MAX_LEVEL).length;

const RULES: readonly Rule[] = [
  {
    id: 'premier-cap',
    name: 'Premier cap',
    detail: 'Faire entrer un premier territoire en mémoire longue.',
    tier: 'cuivre',
    reward: 30,
    earned: (c) =>
      masteredIn(c.cards, 'france-departments') + masteredIn(c.cards, 'world-countries') >= 1,
  },
  {
    id: 'cabotage',
    name: 'Sorti du port',
    detail: 'Rencontrer vingt territoires.',
    tier: 'cuivre',
    reward: 40,
    earned: (c) => seenIn(c.cards, 'france-departments') + seenIn(c.cards, 'world-countries') >= 20,
  },
  {
    id: 'premier-sceau',
    name: 'Premier sceau',
    detail: 'Sceller un cartouche — toute une région, entièrement sue.',
    tier: 'argent',
    reward: 120,
    earned: (c) => sealsIn(c.cards, 'france-departments') + sealsIn(c.cards, 'world-countries') >= 1,
  },
  {
    id: 'tour-de-france',
    name: 'Tour de France',
    detail: 'Avoir rencontré les 101 départements au moins une fois.',
    tier: 'argent',
    reward: 150,
    earned: (c) => seenIn(c.cards, 'france-departments') >= 101,
  },
  {
    id: 'tour-du-monde',
    name: 'Tour du monde',
    detail: 'Avoir rencontré les 193 États membres au moins une fois.',
    tier: 'argent',
    reward: 200,
    earned: (c) => seenIn(c.cards, 'world-countries') >= 193,
  },
  {
    id: 'main-levee',
    name: 'À main levée',
    detail: 'Tenir une série de vingt bonnes réponses.',
    tier: 'argent',
    reward: 100,
    earned: (c) => c.bestCombo >= 20,
  },
  {
    id: 'grand-large',
    name: 'Grand large',
    detail: 'Atteindre le dernier échelon d’un atlas — plus aucune aide.',
    tier: 'argent',
    reward: 150,
    earned: (c) =>
      currentRung('france-departments', c.cards, c.floor) >= MAX_RUNG ||
      currentRung('world-countries', c.cards, c.floor) >= MAX_RUNG,
  },
  {
    id: 'sept-jours',
    name: 'Sept jours en mer',
    detail: 'Tenir une série de sept relevés quotidiens.',
    tier: 'cuivre',
    reward: 60,
    earned: (c) => c.longestStreak >= 7,
  },
  {
    id: 'cent-jours',
    name: 'Cent jours en mer',
    detail: 'Tenir une série de cent relevés quotidiens.',
    tier: 'or',
    reward: 400,
    earned: (c) => c.longestStreak >= 100,
  },
  {
    id: 'cartographe',
    name: 'Cartographe',
    detail: 'Sceller dix cartouches.',
    tier: 'or',
    reward: 300,
    earned: (c) => sealsIn(c.cards, 'france-departments') + sealsIn(c.cards, 'world-countries') >= 10,
  },
  {
    id: 'memoire-longue',
    name: 'Mémoire longue',
    detail: `Porter cinquante cartes jusqu’à la boîte ${MAX_LEVEL}.`,
    tier: 'or',
    reward: 250,
    earned: (c) => atMaxBox(c.cards) >= 50,
  },
  {
    id: 'hexagone',
    name: 'L’hexagone par cœur',
    detail: `Les 101 départements en boîte ${MASTERED_LEVEL} ou au-delà.`,
    tier: 'or',
    reward: 500,
    earned: (c) => masteredIn(c.cards, 'france-departments') >= 101,
  },
  {
    id: 'amiraute',
    name: 'Amirauté',
    detail: 'Atteindre le rang d’Amiral.',
    tier: 'or',
    reward: 500,
    earned: (c) => rankFor(c.xp).index >= MAX_RANK,
  },
];

export const BREVETS: readonly Brevet[] = RULES.map(({ earned: _earned, ...brevet }) => brevet);

export const brevetById = (id: string): Brevet | undefined => BREVETS.find((b) => b.id === id);

export function earnedBrevets(context: BrevetContext): string[] {
  return RULES.filter((rule) => rule.earned(context)).map((rule) => rule.id);
}

export function newBrevets(context: BrevetContext, already: Readonly<Record<string, number>>): {
  ids: string[];
  doublons: number;
} {
  const ids = earnedBrevets(context).filter((id) => already[id] === undefined);
  return {
    ids,
    doublons: ids.reduce((sum, id) => sum + (brevetById(id)?.reward ?? 0), 0),
  };
}

export const TIER_ORDER: Record<BrevetTier, number> = { cuivre: 0, argent: 1, or: 2 };
