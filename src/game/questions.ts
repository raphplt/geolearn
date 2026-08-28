import type { Country, Department, Territory } from '@/data/types';
import { FRANCE, WORLD, type AtlasId } from '@/data';
import { weightedSample, shuffle, sample } from './rng';
import type { CardId } from './srs';

export type Skill =
  | 'locate'
  | 'name'
  | 'prefecture'
  | 'prefectureToDept'
  | 'code'
  | 'capital'
  | 'capitalToCountry'
  | 'flag';

export type Choice = {
  id: string;
  label: string;
  detail?: string;
  flagCode?: string;
};

export type Question = {
  id: string;
  cardId: CardId;
  atlasId: AtlasId;
  skill: Skill;
  prompt: string;
  subject: string;
  flagCode?: string;
  answerId: string;
} & (
  | {
      mode: 'locate';
    }
  | {
      mode: 'choice';
      choices: Choice[];
      highlightId?: string;
    }
);

export const cardIdFor = (atlasId: AtlasId, territoryId: string, skill: Skill): CardId =>
  `${atlasId}:${territoryId}:${skill}`;

export function parseCardId(
  cardId: CardId,
): { atlasId: AtlasId; territoryId: string; skill: Skill } | null {
  const parts = cardId.split(':');
  if (parts.length !== 3) return null;
  const [atlasId, territoryId, skill] = parts as [AtlasId, string, Skill];
  return { atlasId, territoryId, skill };
}

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

function confusability(target: Territory, candidate: Territory, sameGroup: boolean): number {
  let weight = 1;
  if (target.neighbors.includes(candidate.id)) weight *= 6;
  if (sameGroup) weight *= 3;
  if (sharesToken(target.name, candidate.name)) weight *= 5;

  if (target.area > 0 && candidate.area > 0) {
    const ratio = target.area / candidate.area;
    if (ratio > 0.5 && ratio < 2) weight *= 1.8;
  }

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
        flagCode: target.cca2,
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
        flagCode: target.cca2,
        highlightId: target.d === '' ? undefined : target.id,
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
            flagCode: c.cca2,
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
        flagCode: target.cca2,
        choices: shuffle(
          [target, ...distractors].map((c) => ({ id: c.id, label: c.name, detail: c.subregion })),
          rng,
        ),
      };

    default:
      return null;
  }
}

export const SKILLS_BY_ATLAS: Record<AtlasId, readonly Skill[]> = {
  'france-departments': ['name', 'locate', 'prefecture', 'code', 'prefectureToDept'],
  'world-countries': ['flag', 'name', 'locate', 'capital', 'capitalToCountry'],
};

export const SKILL_NEEDS_SHAPE: Record<Skill, boolean> = {
  locate: true,
  name: true,
  prefecture: true,
  prefectureToDept: false,
  code: false,
  capital: false,
  capitalToCountry: false,
  flag: false,
};

export function playablePool(atlasId: AtlasId): (Department | Country)[] {
  if (atlasId === 'france-departments') return FRANCE.territories;
  return WORLD.territories.filter((c) => c.unMember);
}

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
  if ((skill === 'capital' || skill === 'capitalToCountry') && !target.capital) return null;
  if (SKILL_NEEDS_SHAPE[skill] && target.d === '') return null;
  return countryQuestion(target, skill, rng);
}

export function randomQuestion(
  atlasId: AtlasId,
  rng: () => number,
  allowedSkills: readonly Skill[] = SKILLS_BY_ATLAS[atlasId],
  pool: readonly { id: string }[] = playablePool(atlasId),
): Question | null {
  if (pool.length === 0 || allowedSkills.length === 0) return null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const [target] = sample(pool, 1, rng);
    const [skill] = sample(allowedSkills, 1, rng);
    if (!target || !skill) continue;
    const question = buildQuestion(atlasId, target.id, skill, rng);
    if (question) return question;
  }
  return null;
}
