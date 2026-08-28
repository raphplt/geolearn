import type { SessionMode, SessionSummary } from './session';

export type Rank = {
  index: number;
  name: string;
  at: number;
};

export const RANKS: readonly Rank[] = [
  { index: 0, name: 'Mousse', at: 0 },
  { index: 1, name: 'Matelot', at: 200 },
  { index: 2, name: 'Gabier', at: 600 },
  { index: 3, name: 'Timonier', at: 1_400 },
  { index: 4, name: 'Second', at: 3_000 },
  { index: 5, name: 'Lieutenant', at: 6_000 },
  { index: 6, name: 'Capitaine', at: 11_000 },
  { index: 7, name: 'Amiral', at: 20_000 },
];

export const MAX_RANK = RANKS.length - 1;

export function rankFor(xp: number): Rank {
  let rank = RANKS[0]!;
  for (const candidate of RANKS) if (xp >= candidate.at) rank = candidate;
  return rank;
}

export function rankProgress(xp: number): { current: Rank; next: Rank | null; ratio: number } {
  const current = rankFor(xp);
  const next = RANKS[current.index + 1] ?? null;
  if (!next) return { current, next: null, ratio: 1 };
  const span = next.at - current.at;
  return { current, next, ratio: span === 0 ? 1 : Math.min(1, (xp - current.at) / span) };
}

export const PRICES = {
  expeditionPerPoint: 1 / 100,
  dailyBase: 15,
  dailyPerCorrect: 3,
  lessonBase: 5,
  lessonPerCorrect: 2,

  perPromotion: 2,
  perMastery: 10,
  perSeal: 100,
} as const;

export const XP = {
  perPromotion: 10,
  perMastery: 25,
  perSeal: 150,
} as const;

export type LearningDelta = {
  promotions: number;
  masteries: number;
  seals: number;
};

export type EarningLine = {
  label: string;
  doublons: number;
  xp: number;
};

export type Earnings = {
  doublons: number;
  xp: number;
  lines: EarningLine[];
};

export function earningsFor(
  mode: SessionMode,
  summary: SessionSummary,
  delta: LearningDelta,
): Earnings {
  const lines: EarningLine[] = [];

  const play =
    mode === 'expedition'
      ? Math.round(summary.score * PRICES.expeditionPerPoint)
      : mode === 'daily'
        ? PRICES.dailyBase + summary.correct * PRICES.dailyPerCorrect
        : PRICES.lessonBase + summary.correct * PRICES.lessonPerCorrect;

  if (play > 0) {
    lines.push({
      label:
        mode === 'expedition'
          ? 'Expédition'
          : mode === 'daily'
            ? 'Relevé du jour'
            : mode === 'lesson'
              ? 'Révision'
              : 'Découverte',
      doublons: play,
      xp: 0,
    });
  }

  if (delta.promotions > 0) {
    lines.push({
      label: `${delta.promotions} carte${delta.promotions > 1 ? 's' : ''} promue${delta.promotions > 1 ? 's' : ''}`,
      doublons: delta.promotions * PRICES.perPromotion,
      xp: delta.promotions * XP.perPromotion,
    });
  }

  if (delta.masteries > 0) {
    lines.push({
      label: `${delta.masteries} territoire${delta.masteries > 1 ? 's' : ''} en mémoire longue`,
      doublons: delta.masteries * PRICES.perMastery,
      xp: delta.masteries * XP.perMastery,
    });
  }

  if (delta.seals > 0) {
    lines.push({
      label: `${delta.seals} cartouche${delta.seals > 1 ? 's' : ''} scellé${delta.seals > 1 ? 's' : ''}`,
      doublons: delta.seals * PRICES.perSeal,
      xp: delta.seals * XP.perSeal,
    });
  }

  return {
    doublons: lines.reduce((sum, l) => sum + l.doublons, 0),
    xp: lines.reduce((sum, l) => sum + l.xp, 0),
    lines,
  };
}

export type HintId = 'delester' | 'sonder' | 'seconde-chance';

export type HintItem = {
  id: HintId;
  name: string;
  detail: string;
  price: number;
};

export const HINTS: readonly HintItem[] = [
  {
    id: 'delester',
    name: 'Délester',
    detail: 'Écarte deux mauvaises propositions.',
    price: 40,
  },
  {
    id: 'sonder',
    name: 'Sonder',
    detail: 'Resserre la carte autour de la réponse, le temps de la question.',
    price: 55,
  },
  {
    id: 'seconde-chance',
    name: 'Seconde chance',
    detail: 'Répare une avarie et rend la question ratée.',
    price: 90,
  },
];

export type InkId = 'sepia' | 'nuit-de-chine' | 'sanguine';

export type InkItem = {
  id: InkId;
  name: string;
  detail: string;
  price: number;
};

export const INKS: readonly InkItem[] = [
  {
    id: 'sepia',
    name: 'Sépia',
    detail: 'L’encre du portulan. Terre de parchemin, mers vert-de-gris.',
    price: 0,
  },
  {
    id: 'nuit-de-chine',
    name: 'Nuit de Chine',
    detail: 'Bleus profonds et terres d’indigo, à la manière des cartes marines.',
    price: 1_500,
  },
  {
    id: 'sanguine',
    name: 'Sanguine',
    detail: 'Terres brûlées et mers d’ambre, comme un relevé au crayon rouge.',
    price: 2_400,
  },
];

export const hintById = (id: HintId): HintItem => HINTS.find((h) => h.id === id)!;
export const inkById = (id: InkId): InkItem => INKS.find((i) => i.id === id)!;
