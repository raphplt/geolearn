/**
 * Fabrique de questions.
 *
 * Le cœur du sujet n'est pas de tirer une bonne réponse au hasard — c'est de
 * choisir de **bons leurres**. Un quiz dont les mauvaises réponses sont tirées
 * uniformément s'élimine de tête sans rien savoir : demander le chef-lieu de la
 * Corrèze parmi « Tulle, Tokyo, Lille, Ajaccio » ne teste rien. Les leurres
 * doivent être exactement assez proches pour qu'il faille *savoir*.
 *
 * On pondère donc les candidats par leur confusibilité réelle, puis on tire
 * dedans — sans jamais rendre le piège certain, faute de quoi le joueur
 * apprendrait à reconnaître le piège plutôt que la réponse.
 */
import type { Country, Department, Territory } from '@/data/types';
import { FRANCE, WORLD, type AtlasId } from '@/data';
import { weightedSample, shuffle, sample } from './rng';
import type { CardId } from './srs';

export type Skill =
  /* Désigner un territoire sur la carte. */
  | 'locate'
  /* Nommer un territoire mis en évidence sur la carte. */
  | 'name'
  /* France : département → chef-lieu, et réciproque. */
  | 'prefecture'
  | 'prefectureToDept'
  /* France : département → numéro. */
  | 'code'
  /* Monde : pays → capitale, et réciproque. */
  | 'capital'
  | 'capitalToCountry'
  /* Monde : drapeau → pays. */
  | 'flag';

export type Choice = {
  id: string;
  label: string;
  /** Ligne secondaire : région d'un département, continent d'un pays. */
  detail?: string;
  /** Emoji drapeau, pour les questions du mode Monde. */
  emblem?: string;
};

export type Question = {
  /** Identifiant d'instance — change à chaque tirage. */
  id: string;
  /** Carte de révision mise en jeu. */
  cardId: CardId;
  atlasId: AtlasId;
  skill: Skill;
  /**
   * Consigne affichée, **grammaticalement autonome**.
   *
   * Elle ne se raccorde jamais au sujet pour former une phrase : « Quel est le
   * chef-lieu de » + « Loiret » donnerait « de Loiret » au lieu de « du
   * Loiret », et il faudrait connaître le genre et l'initiale des 101
   * départements et des 193 pays pour bien élider. On pose donc le sujet en
   * vedette au-dessus, et la consigne le reprend par un possessif — « son
   * chef-lieu », « sa capitale » — qui s'accorde avec le nom commun et reste
   * juste quel que soit le territoire.
   */
  prompt: string;
  /** Sujet de la question, posé en vedette typographique au-dessus de la consigne. */
  subject: string;
  /** Emoji accompagnant le sujet (drapeau). */
  emblem?: string;
  /** Identifiant du territoire attendu. */
  answerId: string;
} & (
  | {
      /** On répond en touchant la carte. */
      mode: 'locate';
    }
  | {
      /** On répond en choisissant une proposition. */
      mode: 'choice';
      choices: Choice[];
      /** Territoire à mettre en évidence sur la carte pendant la question. */
      highlightId?: string;
    }
);

export const cardIdFor = (atlasId: AtlasId, territoryId: string, skill: Skill): CardId =>
  `${atlasId}:${territoryId}:${skill}`;

/** Décompose un identifiant de carte. Renvoie `null` si la carte est d'un format obsolète. */
export function parseCardId(
  cardId: CardId,
): { atlasId: AtlasId; territoryId: string; skill: Skill } | null {
  const parts = cardId.split(':');
  if (parts.length !== 3) return null;
  const [atlasId, territoryId, skill] = parts as [AtlasId, string, Skill];
  return { atlasId, territoryId, skill };
}

/* ───────────────────── Confusibilité ───────────────────── */

/**
 * Jetons significatifs d'un nom de territoire.
 *
 * Les noms de départements français sont massivement composés — Haute-Loire,
 * Loire-Atlantique, Saône-et-Loire, Loiret. Un joueur ne les confond pas au
 * hasard : il les confond *parce qu'ils partagent un mot*. On extrait donc les
 * composants pour pouvoir sur-pondérer ces voisins-là, qui sont les leurres les
 * plus instructifs qui soient.
 */
const NAME_STOPWORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'sur', 'd', 'l']);

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[\s'’-]+/)
      .filter((token) => token.length > 2 && !NAME_STOPWORDS.has(token)),
  );
}

const tokenCache = new Map<string, Set<string>>();
function tokensOf(name: string): Set<string> {
  let cached = tokenCache.get(name);
  if (!cached) {
    cached = nameTokens(name);
    tokenCache.set(name, cached);
  }
  return cached;
}

function sharesToken(a: string, b: string): boolean {
  const ta = tokensOf(a);
  for (const token of tokensOf(b)) if (ta.has(token)) return true;
  return false;
}

/**
 * Poids de confusibilité d'un candidat face à la bonne réponse.
 *
 * L'échelle est multiplicative et volontairement large : un département
 * limitrophe au nom apparenté doit sortir bien plus souvent qu'un département à
 * l'autre bout du pays, sans pour autant que ce dernier ne sorte jamais — c'est
 * cette part d'imprévu qui empêche le joueur de répondre par élimination.
 */
function confusability(target: Territory, candidate: Territory, sameGroup: boolean): number {
  let weight = 1;
  if (target.neighbors.includes(candidate.id)) weight *= 6;
  if (sameGroup) weight *= 3;
  if (sharesToken(target.name, candidate.name)) weight *= 5;

  /* Une taille comparable rend deux territoires confusibles sur la carte. */
  if (target.area > 0 && candidate.area > 0) {
    const ratio = target.area / candidate.area;
    if (ratio > 0.5 && ratio < 2) weight *= 1.8;
  }

  /* La proximité géographique compte même sans frontière commune. */
  const distance = Math.hypot(
    target.label[0] - candidate.label[0],
    target.label[1] - candidate.label[1],
  );
  if (distance < 600) weight *= 2.4;
  else if (distance < 1200) weight *= 1.5;

  return weight;
}

function pickDistractors<T extends Territory>(
  target: T,
  pool: readonly T[],
  groupOf: (t: T) => string,
  count: number,
  rng: () => number,
): T[] {
  const targetGroup = groupOf(target);
  const candidates = pool.filter((t) => t.id !== target.id);
  return weightedSample(
    candidates,
    (candidate) => confusability(target, candidate, groupOf(candidate) === targetGroup),
    count,
    rng,
  );
}

/* ───────────────────── Fabriques ───────────────────── */

const CHOICE_COUNT = 4;

let sequence = 0;
const nextId = (): string => `q${++sequence}`;

type Built = Question | null;

function departmentQuestion(
  target: Department,
  skill: Skill,
  rng: () => number,
): Built {
  const pool = FRANCE.territories;
  const distractors = pickDistractors(target, pool, (d) => d.regionId, CHOICE_COUNT - 1, rng);
  const base = {
    id: nextId(),
    cardId: cardIdFor('france-departments', target.id, skill),
    atlasId: 'france-departments' as const,
    skill,
    answerId: target.id,
  };

  switch (skill) {
    case 'locate':
      return {
        ...base,
        mode: 'locate',
        prompt: 'Trouvez ce département',
        subject: target.name,
      };

    case 'name':
      return {
        ...base,
        mode: 'choice',
        prompt: 'Quel est ce département ?',
        subject: '',
        highlightId: target.id,
        choices: shuffle(
          [target, ...distractors].map((d) => ({
            id: d.id,
            label: d.name,
            detail: d.region,
          })),
          rng,
        ),
      };

    case 'prefecture':
      return {
        ...base,
        mode: 'choice',
        prompt: 'Quel est son chef-lieu ?',
        subject: target.name,
        highlightId: target.id,
        choices: shuffle(
          [target, ...distractors].map((d) => ({
            id: d.id,
            label: d.prefecture,
            detail: d.region,
          })),
          rng,
        ),
      };

    case 'prefectureToDept':
      return {
        ...base,
        mode: 'choice',
        prompt: 'De quel département est-ce le chef-lieu ?',
        subject: target.prefecture,
        choices: shuffle(
          [target, ...distractors].map((d) => ({
            id: d.id,
            label: d.name,
            detail: `${d.id} · ${d.region}`,
          })),
          rng,
        ),
      };

    case 'code':
      return {
        ...base,
        mode: 'choice',
        prompt: 'Quel est son numéro ?',
        subject: target.name,
        choices: shuffle(
          [target, ...distractors].map((d) => ({ id: d.id, label: d.id })),
          rng,
        ),
      };

    default:
      return null;
  }
}

function countryQuestion(target: Country, skill: Skill, rng: () => number): Built {
  /* Seuls les États membres de l'ONU sont interrogeables : proposer le Sahara
     occidental ou l'Antarctique comme « pays » serait une erreur factuelle. */
  const pool = WORLD.territories.filter((c) => c.unMember);
  const distractors = pickDistractors(target, pool, (c) => c.subregion, CHOICE_COUNT - 1, rng);
  const base = {
    id: nextId(),
    cardId: cardIdFor('world-countries', target.id, skill),
    atlasId: 'world-countries' as const,
    skill,
    answerId: target.id,
  };

  switch (skill) {
    case 'locate':
      return {
        ...base,
        mode: 'locate',
        prompt: 'Trouvez ce pays',
        subject: target.name,
        emblem: target.flag,
      };

    case 'name':
      return {
        ...base,
        mode: 'choice',
        prompt: 'Quel est ce pays ?',
        subject: '',
        highlightId: target.id,
        choices: shuffle(
          [target, ...distractors].map((c) => ({
            id: c.id,
            label: c.name,
            detail: c.subregion,
          })),
          rng,
        ),
      };

    case 'capital':
      return {
        ...base,
        mode: 'choice',
        prompt: 'Quelle est sa capitale ?',
        subject: target.name,
        emblem: target.flag,
        highlightId: target.id,
        choices: shuffle(
          [target, ...distractors].map((c) => ({ id: c.id, label: c.capital, detail: c.subregion })),
          rng,
        ),
      };

    case 'capitalToCountry':
      return {
        ...base,
        mode: 'choice',
        prompt: 'De quel pays est-ce la capitale ?',
        subject: target.capital,
        choices: shuffle(
          [target, ...distractors].map((c) => ({
            id: c.id,
            label: c.name,
            emblem: c.flag,
            detail: c.subregion,
          })),
          rng,
        ),
      };

    case 'flag':
      return {
        ...base,
        mode: 'choice',
        prompt: 'À quel pays appartient ce drapeau ?',
        subject: '',
        emblem: target.flag,
        choices: shuffle(
          [target, ...distractors].map((c) => ({ id: c.id, label: c.name, detail: c.subregion })),
          rng,
        ),
      };

    default:
      return null;
  }
}

/** Compétences disponibles pour chaque atlas, dans l'ordre de difficulté croissante. */
export const SKILLS_BY_ATLAS: Record<AtlasId, readonly Skill[]> = {
  'france-departments': ['name', 'locate', 'prefecture', 'code', 'prefectureToDept'],
  'world-countries': ['flag', 'name', 'locate', 'capital', 'capitalToCountry'],
};

/** Territoires interrogeables d'un atlas : ceux qui ont un contour et un statut légitime. */
export function playablePool(atlasId: AtlasId): (Department | Country)[] {
  if (atlasId === 'france-departments') return FRANCE.territories;
  return WORLD.territories.filter((c) => c.unMember && c.d !== '');
}

/** Construit une question pour un territoire et une compétence donnés. */
export function buildQuestion(
  atlasId: AtlasId,
  territoryId: string,
  skill: Skill,
  rng: () => number,
): Question | null {
  if (atlasId === 'france-departments') {
    const target = FRANCE.territories.find((d) => d.id === territoryId);
    return target ? departmentQuestion(target, skill, rng) : null;
  }
  const target = WORLD.territories.find((c) => c.id === territoryId);
  if (!target || !target.unMember) return null;
  /* Une capitale manquante rendrait la question insoluble. */
  if ((skill === 'capital' || skill === 'capitalToCountry') && !target.capital) return null;
  return countryQuestion(target, skill, rng);
}

/** Tire une question au hasard dans un atlas, en respectant les compétences autorisées. */
export function randomQuestion(
  atlasId: AtlasId,
  rng: () => number,
  allowedSkills: readonly Skill[] = SKILLS_BY_ATLAS[atlasId],
): Question | null {
  const pool = playablePool(atlasId);
  if (pool.length === 0 || allowedSkills.length === 0) return null;

  /* Quelques tentatives : une compétence peut ne pas s'appliquer à un
     territoire donné (pays sans capitale renseignée, par exemple). */
  for (let attempt = 0; attempt < 8; attempt++) {
    const [target] = sample(pool, 1, rng);
    const [skill] = sample(allowedSkills, 1, rng);
    if (!target || !skill) continue;
    const question = buildQuestion(atlasId, target.id, skill, rng);
    if (question) return question;
  }
  return null;
}
