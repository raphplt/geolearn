import type { AtlasId } from '@/data';
import type { Atlas, Territory } from '@/data/types';
import { parseCardId, playablePool } from './questions';
import { MASTERED_LEVEL, type Card, type CardId } from './srs';

export type Mastery = {
  byTerritory: Map<string, number>;
  mastered: number;
  started: number;
  total: number;
};

export function masteryOf(cards: Readonly<Record<CardId, Card>>, atlasId: AtlasId): Mastery {
  const byTerritory = new Map<string, number>();

  for (const [cardId, card] of Object.entries(cards)) {
    const parsed = parseCardId(cardId);
    if (!parsed || parsed.atlasId !== atlasId) continue;
    const current = byTerritory.get(parsed.territoryId);
    byTerritory.set(
      parsed.territoryId,
      current === undefined ? card.level : Math.min(current, card.level),
    );
  }

  let mastered = 0;
  for (const level of byTerritory.values()) if (level >= MASTERED_LEVEL) mastered++;

  return {
    byTerritory,
    mastered,
    started: byTerritory.size,
    total: playableIds(atlasId).size,
  };
}

/**
 * The denominator is what the game can actually ask about — the 101
 * departments, the 193 member states — and not what the atlas happens to be
 * able to draw. Every screen counts the same set.
 */
const playableCache = new Map<AtlasId, Set<string>>();

export function playableIds(atlasId: AtlasId): Set<string> {
  let ids = playableCache.get(atlasId);
  if (!ids) {
    ids = new Set(playablePool(atlasId).map((t) => t.id));
    playableCache.set(atlasId, ids);
  }
  return ids;
}

export const masteryRatio = ({ mastered, total }: Pick<Mastery, 'mastered' | 'total'>): number =>
  total === 0 ? 0 : mastered / total;

export type Cartouche = {
  id: string;
  name: string;
  territoryIds: string[];
  mastered: number;
  sealed: boolean;
};

function groupOf(atlasId: AtlasId, territory: Territory): { id: string; name: string } | null {
  if (atlasId === 'france-departments') {
    const dept = territory as { regionId?: string; region?: string };
    if (!dept.regionId || !dept.region) return null;
    return { id: dept.regionId, name: dept.region };
  }
  const country = territory as { subregion?: string };
  if (!country.subregion) return null;
  return { id: country.subregion, name: country.subregion };
}

export function cartouchesOf(
  mastery: Mastery,
  atlasId: AtlasId,
  atlas: Atlas<Territory>,
): Cartouche[] {
  const groups = new Map<string, Cartouche>();
  const playable = playableIds(atlasId);

  for (const territory of atlas.territories) {
    if (!playable.has(territory.id)) continue;
    const group = groupOf(atlasId, territory);
    if (!group) continue;

    let cartouche = groups.get(group.id);
    if (!cartouche) {
      cartouche = { id: group.id, name: group.name, territoryIds: [], mastered: 0, sealed: false };
      groups.set(group.id, cartouche);
    }
    cartouche.territoryIds.push(territory.id);
    if ((mastery.byTerritory.get(territory.id) ?? 0) >= MASTERED_LEVEL) cartouche.mastered++;
  }

  const out: Cartouche[] = [];
  for (const cartouche of groups.values()) {
    if (cartouche.territoryIds.length < 2) continue;
    cartouche.sealed = cartouche.mastered === cartouche.territoryIds.length;
    out.push(cartouche);
  }

  return out.sort(
    (a, b) =>
      Number(b.sealed) - Number(a.sealed) ||
      b.mastered / b.territoryIds.length - a.mastered / a.territoryIds.length ||
      a.name.localeCompare(b.name),
  );
}

export function sealedIds(
  cards: Readonly<Record<CardId, Card>>,
  atlasId: AtlasId,
  atlas: Atlas<Territory>,
): string[] {
  const mastery = masteryOf(cards, atlasId);
  return cartouchesOf(mastery, atlasId, atlas)
    .filter((c) => c.sealed)
    .map((c) => `${atlasId}:${c.id}`);
}
