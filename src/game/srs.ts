/**
 * Répétition espacée — la couche « maîtrise » du jeu.
 *
 * Le modèle est un système de **boîtes de Leitner** plutôt qu'un SM-2 complet.
 * Ce choix est délibéré : SM-2 module un facteur de facilité continu, ce qui
 * suppose que le joueur note lui-même sa difficulté ressentie. Ici les réponses
 * sont binaires et souvent contraintes par le temps, si bien que le facteur de
 * facilité n'aurait aucune donnée fiable à se mettre sous la dent. Les boîtes
 * donnent un signal net, se racontent au joueur (« ce département est en boîte
 * 4 »), et se dessinent — c'est ce qui alimente la carte de maîtrise.
 */

/** Une carte de révision : un territoire vu sous un angle précis. */
export type CardId = string;

export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type Card = {
  /** `atlas:territoire:compétence`, par exemple `france-departments:15:locate`. */
  id: CardId;
  level: MasteryLevel;
  /** Prochaine échéance, en millisecondes epoch. */
  due: number;
  /** Nombre de passages, toutes réponses confondues. */
  reviews: number;
  /** Nombre de rechutes depuis un niveau acquis — signale les pièges tenaces. */
  lapses: number;
  /** Dernier passage, pour l'historique et les séries. */
  lastReviewed: number;
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * Intervalles par niveau.
 *
 * Le niveau 0 revient dans la même session (dix minutes) : une carte ratée doit
 * être revue tant que le contexte est frais, c'est là que se joue l'essentiel de
 * l'encodage. Au-delà, la progression suit approximativement le triplement
 * classique, plafonné à quatre mois — inutile de programmer une révision à deux
 * ans dans une application qu'on rouvre chaque semaine.
 */
export const INTERVALS: readonly number[] = [
  10 * MINUTE,
  1 * DAY,
  3 * DAY,
  8 * DAY,
  21 * DAY,
  60 * DAY,
];

export const MAX_LEVEL: MasteryLevel = 5;

/** Une carte est considérée acquise à partir de la boîte 3 (environ une semaine de rétention). */
export const MASTERED_LEVEL: MasteryLevel = 3;

export function createCard(id: CardId, now: number): Card {
  return { id, level: 0, due: now, reviews: 0, lapses: 0, lastReviewed: 0 };
}

export type ReviewOutcome = {
  correct: boolean;
  /** Temps de réponse en millisecondes — une réponse juste mais laborieuse ne vaut pas une réponse immédiate. */
  elapsed?: number;
};

/**
 * Seuil de « réponse assurée ».
 *
 * Au-delà, une bonne réponse ne fait pas progresser d'une boîte entière : le
 * joueur a trouvé, mais en cherchant. Sans ce garde-fou, on promeut au niveau
 * maximal des connaissances que le joueur reconstitue péniblement par
 * élimination, et la carte de maîtrise devient un mensonge flatteur.
 */
const HESITATION_MS = 6_000;

export function review(card: Card, outcome: ReviewOutcome, now: number): Card {
  const reviews = card.reviews + 1;

  if (!outcome.correct) {
    /* Rechute : retour à la case départ. On ne descend que d'un cran depuis les
       petits niveaux, mais une carte acquise qu'on rate retombe bien à zéro —
       c'est le signal le plus honnête, et le plus utile pédagogiquement. */
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

/**
 * Priorité d'une carte dans la file de révision.
 *
 * Ordre voulu : d'abord les cartes échues, la plus en retard en tête ; puis les
 * cartes jamais vues ; les cartes à jour ne sont proposées qu'en dernier
 * recours, quand il n'y a plus rien d'autre à réviser.
 */
export function reviewPriority(card: Card, now: number): number {
  if (isDue(card, now)) {
    const overdue = now - card.due;
    /* Les rechutes remontent : une carte qu'on rate sans cesse mérite d'être
       traitée avant une carte simplement échue depuis longtemps. */
    return 1_000_000 + overdue / 1000 + card.lapses * 50_000;
  }
  if (card.reviews === 0) return 500_000;
  return Math.max(0, 100_000 - (card.due - now) / 1000);
}
