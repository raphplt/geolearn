import { probe } from '@/fx/probe';
import type { Atlas, BBox, Point, Territory } from '@/data/types';

export type Ring = Float64Array;

export type TerritoryGeometry = {
  id: string;
  rings: Ring[];
  bbox: BBox;
  label: Point;
};

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

export type HitIndex = {
  atlasId: string;
  entries: TerritoryGeometry[];
  pointOnly: TerritoryGeometry[];
};

const indexCache = new Map<string, HitIndex>();

export function buildHitIndex(atlas: Atlas<Territory>): HitIndex {
  const cached = indexCache.get(atlas.id);
  if (cached) return cached;

  const done = probe.open(`map:index:${atlas.id}`);
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
  done();
  return index;
}

/**
 * Decoding every path of an atlas costs tens of milliseconds. Called ahead of
 * the first "situer" question — or of opening the Atlas tab — it happens while
 * the player is still reading, and the render that needs it finds it built.
 */
export function warmHitIndex(atlas: Atlas<Territory>): void {
  if (indexCache.has(atlas.id)) return;
  setTimeout(() => buildHitIndex(atlas), 0);
}

/** The index if it is already warm, and never the cost of building one. */
export const peekHitIndex = (atlas: Atlas<Territory>): HitIndex | null =>
  indexCache.get(atlas.id) ?? null;

export type HitOptions = {
  tolerance?: number;
  candidates?: ReadonlySet<string>;
};

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

export function padBBox([x0, y0, x1, y1]: BBox, ratio: number): BBox {
  const w = x1 - x0;
  const h = y1 - y0;
  const px = w * ratio;
  const py = h * ratio;
  return [x0 - px, y0 - py, x1 + px, y1 + py];
}

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
