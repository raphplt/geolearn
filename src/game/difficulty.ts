import { FRANCE, WORLD, type AtlasId } from '@/data';
import type { Country, Department, Territory } from '@/data/types';

const WEIGHTS = {
  'france-departments': { fame: 0.78, size: 0.22 },
  'world-countries': { fame: 0.55, size: 0.45 },
} as const;

const OVERSEAS_RANK = { fame: 0.72, size: 0.5 } as const;

function percentileRanks<T>(items: readonly T[], valueOf: (item: T) => number): Map<T, number> {
  const sorted = [...items].sort((a, b) => valueOf(a) - valueOf(b));
  const ranks = new Map<T, number>();
  const last = Math.max(1, sorted.length - 1);

  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && valueOf(sorted[j + 1]!) === valueOf(sorted[i]!)) j++;
    const rank = (i + j) / 2 / last;
    for (let k = i; k <= j; k++) ranks.set(sorted[k]!, rank);
    i = j + 1;
  }

  return ranks;
}

export type DifficultyTable = {
  byId: Map<string, number>;
  ordered: Territory[];
};

function buildTable(atlasId: AtlasId): DifficultyTable {
  const weights = WEIGHTS[atlasId];

  const pool: Territory[] =
    atlasId === 'france-departments'
      ? FRANCE.territories.filter((d) => d.d !== '')
      : WORLD.territories.filter((c) => c.unMember);

  const overseas = (t: Territory): boolean =>
    atlasId === 'france-departments' && (t as Department).overseas;

  const comparable = pool.filter((t) => !overseas(t));

  const fame = percentileRanks(comparable, (t) =>
    atlasId === 'france-departments'
      ? (t as Department).prefecturePopulation
      : (t as Country).population,
  );
  const size = percentileRanks(comparable, (t) =>
    atlasId === 'france-departments' ? t.area : (t as Country).areaKm2,
  );

  const byId = new Map<string, number>();
  for (const territory of pool) {
    const ranks = overseas(territory)
      ? OVERSEAS_RANK
      : { fame: fame.get(territory)!, size: size.get(territory)! };
    byId.set(territory.id, 1 - (weights.fame * ranks.fame + weights.size * ranks.size));
  }

  const ordered = [...pool].sort((a, b) => byId.get(a.id)! - byId.get(b.id)!);
  return { byId, ordered };
}

const tables = new Map<AtlasId, DifficultyTable>();

export function difficultyTable(atlasId: AtlasId): DifficultyTable {
  let table = tables.get(atlasId);
  if (!table) {
    table = buildTable(atlasId);
    tables.set(atlasId, table);
  }
  return table;
}

export const difficultyOf = (atlasId: AtlasId, territoryId: string): number =>
  difficultyTable(atlasId).byId.get(territoryId) ?? 1;

export const easiest = (atlasId: AtlasId, count: number): Territory[] =>
  difficultyTable(atlasId).ordered.slice(0, Math.max(0, count));
