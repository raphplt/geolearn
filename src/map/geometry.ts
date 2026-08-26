/**
 * Géométrie de la carte côté application : décodage des tracés et pointé.
 *
 * Les atlas sont livrés en commandes SVG relatives à coordonnées entières (voir
 * `scripts/lib/geo-utils.mts`). C'est parfait pour peindre — react-native-svg
 * les consomme telles quelles — mais illisible pour savoir *quel territoire a
 * été touché*. Ce module reconstruit à la demande les anneaux de polygones, et
 * les met en cache : le décodage des 101 départements coûte quelques
 * millisecondes, une seule fois par atlas.
 */
import type { Atlas, BBox, Point, Territory } from '@/data/types';

/** Anneau polygonal aplati : [x0, y0, x1, y1, …]. Un tableau plat par anneau plutôt
 *  qu'un tableau de paires — trois fois moins d'objets à allouer. */
export type Ring = Float64Array;

export type TerritoryGeometry = {
  id: string;
  rings: Ring[];
  bbox: BBox;
  label: Point;
};

/**
 * Reconstruit les anneaux d'un tracé relatif.
 *
 * Reproduit fidèlement la sémantique SVG de `z`, qui ramène le point courant au
 * **début du sous-tracé** et non à l'endroit où le tracé s'est arrêté. Un
 * décodeur qui l'ignore place correctement le continent puis décale chaque île
 * qui le suit.
 */
export function decodePath(d: string): Ring[] {
  const rings: Ring[] = [];
  if (!d) return rings;

  let current: number[] = [];
  let x = 0;
  let y = 0;
  let subpathX = 0;
  let subpathY = 0;

  const flush = (): void => {
    if (current.length >= 6) rings.push(Float64Array.from(current));
    current = [];
  };

  for (const [, rawCommand, rawArgs] of d.matchAll(/([mlz])([-\d,]*)/gi)) {
    const command = rawCommand!.toLowerCase();

    if (command === 'z') {
      flush();
      x = subpathX;
      y = subpathY;
      continue;
    }

    const comma = rawArgs!.indexOf(',', 1);
    if (comma < 0) continue;
    const dx = Number(rawArgs!.slice(0, comma));
    const dy = Number(rawArgs!.slice(comma + 1));
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;

    x += dx;
    y += dy;

    if (command === 'm') {
      flush();
      subpathX = x;
      subpathY = y;
    }
    current.push(x, y);
  }
  flush();

  return rings;
}

/**
 * Appartenance d'un point à un ensemble d'anneaux, règle pair-impair.
 *
 * La règle pair-impair traite gratuitement les deux cas qui nous occupent : les
 * archipels (chaque île bascule l'état, donc un point sur n'importe laquelle
 * compte) et les enclaves (un anneau intérieur exclut sa surface).
 */
export function pointInRings(px: number, py: number, rings: readonly Ring[]): boolean {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const xi = ring[i]!;
      const yi = ring[i + 1]!;
      const xj = ring[j]!;
      const yj = ring[j + 1]!;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

const inBBox = (px: number, py: number, [x0, y0, x1, y1]: BBox, slack = 0): boolean =>
  px >= x0 - slack && px <= x1 + slack && py >= y0 - slack && py <= y1 + slack;

/** Index de pointé d'un atlas. Construit une fois, réutilisé pour toutes les parties. */
export type HitIndex = {
  atlasId: string;
  entries: TerritoryGeometry[];
  /** Territoires sans contour (micro-États repérés par un point seul). */
  pointOnly: TerritoryGeometry[];
};

const indexCache = new Map<string, HitIndex>();

export function buildHitIndex<T extends Territory>(atlas: Atlas<T>): HitIndex {
  const cached = indexCache.get(atlas.id);
  if (cached) return cached;

  const entries: TerritoryGeometry[] = [];
  const pointOnly: TerritoryGeometry[] = [];

  for (const t of atlas.territories) {
    const geometry: TerritoryGeometry = {
      id: t.id,
      rings: decodePath(t.d),
      bbox: t.bbox,
      label: t.label,
    };
    (geometry.rings.length > 0 ? entries : pointOnly).push(geometry);
  }

  const index: HitIndex = { atlasId: atlas.id, entries, pointOnly };
  indexCache.set(atlas.id, index);
  return index;
}

export type HitOptions = {
  /**
   * Rayon de rattrapage, en unités atlas. Un doigt couvre une surface bien plus
   * large qu'un département comme le Val-de-Marne : sans tolérance, ces
   * territoires seraient injouables sans zoomer. En deçà de ce rayon, on
   * rattache le toucher au territoire le plus proche.
   */
  tolerance?: number;
  /** Restreint la recherche à ces identifiants (par exemple les territoires encore en jeu). */
  candidates?: ReadonlySet<string>;
};

/**
 * Territoire touché en un point de l'espace atlas.
 *
 * Deux passes délibérément ordonnées : d'abord le test d'appartenance exact,
 * pour qu'un toucher franc dans un grand territoire ne soit jamais volé par un
 * petit voisin ; ensuite seulement le rattrapage au plus proche, qui rend
 * jouables les territoires minuscules.
 */
export function hitTest(
  index: HitIndex,
  px: number,
  py: number,
  { tolerance = 0, candidates }: HitOptions = {},
): string | null {
  const eligible = (id: string): boolean => !candidates || candidates.has(id);

  for (const entry of index.entries) {
    if (!eligible(entry.id)) continue;
    if (!inBBox(px, py, entry.bbox)) continue;
    if (pointInRings(px, py, entry.rings)) return entry.id;
  }

  if (tolerance <= 0) return null;

  let best: string | null = null;
  let bestDistance = tolerance;

  /* Les territoires sans contour ne sont atteignables *que* par ce rattrapage :
     on les mesure depuis leur point, les autres depuis leur emprise. */
  for (const entry of index.pointOnly) {
    if (!eligible(entry.id)) continue;
    const distance = Math.hypot(px - entry.label[0], py - entry.label[1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry.id;
    }
  }

  for (const entry of index.entries) {
    if (!eligible(entry.id)) continue;
    if (!inBBox(px, py, entry.bbox, tolerance)) continue;
    const distance = distanceToRings(px, py, entry.rings, bestDistance);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry.id;
    }
  }

  return best;
}

/**
 * Distance d'un point au bord le plus proche d'un ensemble d'anneaux.
 *
 * `ceiling` permet d'abandonner dès qu'on sait qu'un candidat ne peut plus
 * gagner : sur un atlas mondial, cela évite de parcourir les 40 000 segments de
 * la Russie pour un toucher qui se trouve en Belgique.
 */
function distanceToRings(px: number, py: number, rings: readonly Ring[], ceiling: number): number {
  let min = ceiling;
  for (const ring of rings) {
    const n = ring.length;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      const d = distanceToSegment(px, py, ring[j]!, ring[j + 1]!, ring[i]!, ring[i + 1]!);
      if (d < min) min = d;
    }
  }
  return min;
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Emprise élargie d'une marge relative — utilisée pour cadrer sur un territoire. */
export function padBBox([x0, y0, x1, y1]: BBox, ratio: number): BBox {
  const w = x1 - x0;
  const h = y1 - y0;
  const px = w * ratio;
  const py = h * ratio;
  return [x0 - px, y0 - py, x1 + px, y1 + py];
}

/** Emprise englobant plusieurs emprises. */
export function unionBBox(boxes: readonly BBox[]): BBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    if (b[0] < x0) x0 = b[0];
    if (b[1] < y0) y0 = b[1];
    if (b[2] > x1) x1 = b[2];
    if (b[3] > y1) y1 = b[3];
  }
  return [x0, y0, x1, y1];
}
