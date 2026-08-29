import type { AtlasId } from '@/data';
import { currentRung, undiscovered } from './ladder';
import { dueCount, REVISION_BATCH } from './revision';
import { DAILY_QUESTION_COUNT, DISCOVERY_BATCH, type SessionMode } from './session';
import type { Card, CardId } from './srs';

export type PlanId = 'revision' | 'discovery' | 'expedition' | 'daily';

export type Plan = {
  id: PlanId;
  atlasId: AtlasId;
  mode: SessionMode;
  /** What the button says. Never just "Jouer". */
  action: string;
  title: string;
  detail: string;
  duration: string;
  count: number;
  available: boolean;
};

export type PlanInput = {
  atlasId: AtlasId;
  cards: Readonly<Record<CardId, Card>>;
  floor: number;
  dailyDone: boolean;
  now: number;
};

const plural = (n: number, one: string, many: string): string => (n > 1 ? many : one);

/**
 * The three layers of the game, in the order the app recommends them: revise
 * what is fading, discover what is unknown, then practise. A due card is a
 * trace on its way out — it costs seconds today and a full relearning next
 * week.
 */
export function plans({ atlasId, cards, floor, dailyDone, now }: PlanInput): Plan[] {
  const rung = currentRung(atlasId, cards, floor);
  const due = Math.min(dueCount(cards, atlasId, now), REVISION_BATCH);
  const fresh = Math.min(undiscovered(atlasId, cards, rung).length, DISCOVERY_BATCH);

  return [
    {
      id: 'revision',
      atlasId,
      mode: 'lesson',
      action: due > 0 ? `Réviser ${due} ${plural(due, 'carte', 'cartes')}` : 'Réviser',
      title: 'Révision',
      detail:
        due > 0
          ? `${due} ${plural(due, 'carte échue', 'cartes échues')}, la plus en retard d’abord`
          : 'Rien n’est encore arrivé à échéance',
      duration: '≈ 2 min',
      count: due,
      available: due > 0,
    },
    {
      id: 'discovery',
      atlasId,
      mode: 'discovery',
      action:
        fresh > 0
          ? `Découvrir ${fresh} ${plural(fresh, 'territoire', 'territoires')}`
          : 'Découvrir',
      title: 'Découverte',
      detail:
        fresh > 0
          ? `${fresh} ${plural(fresh, 'territoire présenté', 'territoires présentés')}, puis vérifiés`
          : 'Tout le palier a été rencontré',
      duration: '≈ 2 min',
      count: fresh,
      available: fresh > 0,
    },
    {
      id: 'expedition',
      atlasId,
      mode: 'expedition',
      action: 'Lever l’ancre',
      title: 'Expédition',
      detail: 'Une réserve de temps s’épuise ; les bonnes réponses la rechargent',
      duration: '1 à 3 min',
      count: 0,
      available: true,
    },
    {
      id: 'daily',
      atlasId,
      mode: 'daily',
      action: 'Rendre le relevé',
      title: 'Relevé du jour',
      detail: dailyDone
        ? 'Rendu. Le prochain arrive demain'
        : `${DAILY_QUESTION_COUNT} questions, les mêmes pour tout le monde`,
      duration: '≈ 1 min',
      count: dailyDone ? 0 : DAILY_QUESTION_COUNT,
      available: !dailyDone,
    },
  ];
}

const URGENCY: readonly PlanId[] = ['revision', 'discovery', 'expedition', 'daily'];

/**
 * The one the app puts under the thumb, before any menu is opened.
 *
 * A player learning both atlases has one queue, not two: a card falling due on
 * the world is more urgent than a fresh department, whatever screen they last
 * looked at. Ties go to the atlas listed first, which callers order by the one
 * currently on screen.
 */
export function recommended(inputs: readonly PlanInput[]): Plan {
  const all = inputs.flatMap(plans);

  for (const id of URGENCY) {
    const candidates = all.filter((p) => p.id === id && p.available);
    if (candidates.length === 0) continue;
    return candidates.reduce((best, p) => (p.count > best.count ? p : best));
  }

  return all.find((p) => p.id === 'expedition') ?? all[0]!;
}
