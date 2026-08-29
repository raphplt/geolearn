import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { presimplify, simplify } from 'topojson-simplify';
import { topology } from 'topojson-server';
import { feature, merge, neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

type PresimplifyInput = Parameters<typeof presimplify>[0];

export function simplifyPreservingTopology<P>(
  features: Feature<Geometry, P>[],
  tolerance: number,
): { features: Feature<Geometry, P>[]; neighborIndices: number[][] } {
  const collection: FeatureCollection<Geometry, P> = { type: 'FeatureCollection', features };
  const topo = topology({ layer: collection as never }) as unknown as PresimplifyInput;
  const simplified = simplify(presimplify(topo), tolerance) as unknown as Topology;

  const layer = simplified.objects.layer as GeometryCollection;
  const neighborIndices = neighbors(layer.geometries);
  const restored = feature(simplified, layer) as FeatureCollection<Geometry, P>;

  return { features: restored.features, neighborIndices };
}

export function roundPath(d: string, decimals = 1): string {
  const factor = 10 ** decimals;
  return d.replace(/-?\d+\.\d+/g, (m) => String(Math.round(Number(m) * factor) / factor));
}

function pointInRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(x: number, y: number, a: Position, b: Position): number {
  const [ax, ay] = a as [number, number];
  const [bx, by] = b as [number, number];
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lenSq));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.hypot(x - px, y - py);
}

function signedDistance(x: number, y: number, rings: Position[][]): number {
  let inside = false;
  let min = Infinity;
  for (const ring of rings) {
    if (pointInRing(x, y, ring)) inside = !inside;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      min = Math.min(min, distToSegment(x, y, ring[i]!, ring[j]!));
    }
  }
  return inside ? min : -min;
}

export function poleOfInaccessibility(rings: Position[][]): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of rings[0] ?? []) {
    minX = Math.min(minX, px as number);
    maxX = Math.max(maxX, px as number);
    minY = Math.min(minY, py as number);
    maxY = Math.max(maxY, py as number);
  }

  let best: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
  let bestScore = -Infinity;
  let cellW = (maxX - minX) / 16;
  let cellH = (maxY - minY) / 16;
  let [cx, cy] = best;
  let spanX = maxX - minX;
  let spanY = maxY - minY;

  for (let pass = 0; pass < 3; pass++) {
    for (let gx = 0; gx <= 16; gx++) {
      for (let gy = 0; gy <= 16; gy++) {
        const x = cx - spanX / 2 + (gx / 16) * spanX;
        const y = cy - spanY / 2 + (gy / 16) * spanY;
        const score = signedDistance(x, y, rings);
        if (score > bestScore) {
          bestScore = score;
          best = [x, y];
        }
      }
    }
    [cx, cy] = best;
    spanX = cellW * 2;
    spanY = cellH * 2;
    cellW /= 8;
    cellH /= 8;
  }

  return best;
}

export function ringsOf(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

export function mainRingsOf(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type !== 'MultiPolygon') return [];

  let best: Position[][] = [];
  let bestArea = -Infinity;
  for (const polygon of geometry.coordinates) {
    const area = Math.abs(planarRingArea(polygon[0] ?? []));
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }
  return best;
}

export function planarRingArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    sum += xj * yi - xi * yj;
  }
  return sum / 2;
}

export function encodeRelativePath(d: string): string {
  if (!d) return '';

  const out: string[] = [];
  let penX = 0;
  let penY = 0;
  let subpathX = 0;
  let subpathY = 0;

  const emit = (command: 'm' | 'l', x: number, y: number): void => {
    const dx = Math.round(x - penX);
    const dy = Math.round(y - penY);
    if (command === 'l' && dx === 0 && dy === 0) return;
    out.push(`${command}${dx},${dy}`);
    penX += dx;
    penY += dy;
  };

  for (const [, rawCommand, rawArgs] of d.matchAll(/([MLZ])([-\d.,e]*)/gi)) {
    const command = rawCommand!.toUpperCase();

    if (command === 'Z') {
      out.push('z');
      penX = subpathX;
      penY = subpathY;
      continue;
    }

    const [x, y] = (rawArgs ?? '').split(',').map(Number);
    if (x === undefined || y === undefined || Number.isNaN(x) || Number.isNaN(y)) continue;

    if (command === 'M') {
      emit('m', x, y);
      subpathX = penX;
      subpathY = penY;
    } else {
      emit('l', x, y);
    }
  }

  return out.join('');
}

export function decodeRelativePath(d: string): [number, number][] {
  const points: [number, number][] = [];
  let x = 0;
  let y = 0;
  let subpathX = 0;
  let subpathY = 0;

  for (const [, rawCommand, rawArgs] of d.matchAll(/([mlz])([-\d.,]*)/gi)) {
    const command = rawCommand!.toLowerCase();
    if (command === 'z') {
      x = subpathX;
      y = subpathY;
      continue;
    }
    const [dx, dy] = (rawArgs ?? '').split(',').map(Number);
    if (dx === undefined || dy === undefined) continue;
    x += dx;
    y += dy;
    if (command === 'm') {
      subpathX = x;
      subpathY = y;
    }
    points.push([x, y]);
  }
  return points;
}

export function decodeAbsolutePath(d: string): [number, number][] {
  const points: [number, number][] = [];
  for (const [, command, rawArgs] of d.matchAll(/([MLZ])([-\d.,e]*)/gi)) {
    if (command!.toUpperCase() === 'Z') continue;
    const [x, y] = (rawArgs ?? '').split(',').map(Number);
    if (x === undefined || y === undefined || Number.isNaN(x) || Number.isNaN(y)) continue;
    points.push([x, y]);
  }
  return points;
}

export function dissolveRings(rings: Position[][]): string {
  if (rings.length === 0) return '';

  const geometries = rings.map((ring) => {
    const closed =
      ring.length > 0 && (ring[0]![0] !== ring.at(-1)![0] || ring[0]![1] !== ring.at(-1)![1])
        ? [...ring, ring[0]!]
        : ring;
    return { type: 'Polygon' as const, coordinates: [closed] };
  });

  const topo = topology({ land: { type: 'GeometryCollection', geometries } } as never, 1e5);
  const land = merge(
    topo as never,
    (topo.objects.land as never as { geometries: never[] }).geometries,
  );

  const parts: string[] = [];
  for (const polygon of land.coordinates) {
    for (const ring of polygon) {
      parts.push(
        ring
          .map(
            (point, i) =>
              `${i === 0 ? 'M' : 'L'}${Math.round(point[0] ?? 0)},${Math.round(point[1] ?? 0)}`,
          )
          .join('') + 'Z',
      );
    }
  }

  return encodeRelativePath(parts.join(''));
}
