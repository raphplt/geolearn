import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { presimplify, simplify } from 'topojson-simplify';
import { topology } from 'topojson-server';
import { feature, neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** topojson-simplify exige des propriétés non nullables ; on s'aligne sur sa signature. */
type PresimplifyInput = Parameters<typeof presimplify>[0];

/**
 * Simplifie un ensemble de polygones **en préservant la topologie**.
 *
 * C'est le point crucial : des départements voisins partagent une frontière.
 * Une simplification indépendante par polygone (Douglas-Peucker naïf) ferait
 * diverger les deux versions d'une même frontière et ouvrirait des fentes
 * blanches entre les territoires. Le passage par une topologie TopoJSON
 * garantit qu'un arc partagé n'est simplifié qu'une seule fois.
 *
 * @param tolerance Aire minimale d'un triangle Visvalingam, en degrés carrés.
 *                  1e-5 ≈ quelques centaines de mètres aux latitudes françaises.
 */
export function simplifyPreservingTopology<P>(
  features: Feature<Geometry, P>[],
  tolerance: number,
): { features: Feature<Geometry, P>[]; neighborIndices: number[][] } {
  const collection: FeatureCollection<Geometry, P> = { type: 'FeatureCollection', features };
  /* Les types de topojson-server et topojson-simplify divergent sur la nullabilité
     des propriétés ; le passage par `unknown` est sans risque à l'exécution. */
  const topo = topology({ layer: collection as never }) as unknown as PresimplifyInput;
  const simplified = simplify(presimplify(topo), tolerance) as unknown as Topology;

  const layer = simplified.objects.layer as GeometryCollection;
  const neighborIndices = neighbors(layer.geometries);
  const restored = feature(simplified, layer) as FeatureCollection<Geometry, P>;

  return { features: restored.features, neighborIndices };
}

/**
 * Réduit la précision décimale d'un tracé SVG.
 *
 * d3-geo sérialise en flottants pleine précision (« 412.83729518374 »), ce qui
 * pèse pour rien : dans un viewBox de 1000 unités, un dixième d'unité est déjà
 * sous le pixel sur un écran de téléphone. Le gain est typiquement de 55 %.
 */
export function roundPath(d: string, decimals = 1): string {
  const factor = 10 ** decimals;
  return d.replace(/-?\d+\.\d+/g, (m) => String(Math.round(Number(m) * factor) / factor));
}

/** Teste l'appartenance d'un point à un anneau polygonal (lancer de rayon). */
function pointInRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance d'un point au segment [a, b]. */
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

/** Distance signée d'un point au bord du polygone : positive à l'intérieur. */
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

/**
 * Pôle d'inaccessibilité : le point intérieur le plus éloigné de tout bord.
 *
 * On ne peut pas utiliser le centroïde pour poser une étiquette : sur une forme
 * concave ou en croissant (les Bouches-du-Rhône, la Norvège, la Croatie) il
 * tombe hors du territoire et l'étiquette flotte dans la mer. On procède par
 * raffinement de grille — plus simple que le polylabel de Mapbox, et largement
 * suffisant puisque le calcul est fait une fois à la compilation.
 */
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

  /* Trois passes : balayage grossier, puis resserrement autour du meilleur point. */
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

/** Extrait tous les anneaux d'un Polygon ou MultiPolygon. */
export function ringsOf(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

/** Anneaux du plus grand polygone d'un MultiPolygon — le corps principal du territoire. */
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

/** Aire planaire signée d'un anneau (formule du lacet). */
export function planarRingArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    sum += xj * yi - xi * yj;
  }
  return sum / 2;
}

/**
 * Ré-encode un tracé absolu en commandes **relatives à coordonnées entières**.
 *
 * d3-geo sérialise en absolu et en pleine précision : « M1651.8372,3564.0284L… ».
 * Or les sommets d'un littoral simplifié sont voisins les uns des autres, si
 * bien que l'écart entre deux points tient sur un ou deux chiffres. Passer en
 * relatif et arrondir à l'entier divise le poids par quatre environ. C'est pour
 * cela que l'espace atlas est défini à 4000 unités de large plutôt que 1000 :
 * l'unité entière y vaut ~275 m, sous le pixel même au zoom maximal.
 *
 * Deux pièges, tous deux traités ici :
 *
 * 1. **La dérive.** Arrondir chaque delta indépendamment ferait s'accumuler
 *    l'erreur le long du tracé, et un littoral de mille points finirait
 *    visiblement décalé. On calcule donc chaque delta par rapport à la position
 *    *déjà écrite*, ce qui redistribue l'erreur au lieu de la sommer et borne
 *    l'écart absolu à un demi-quantum où que l'on soit sur le tracé.
 *
 * 2. **Le retour de `z`.** En SVG, `closepath` ramène le point courant au début
 *    du sous-tracé, et non là où le tracé s'est arrêté. Sans en tenir compte,
 *    chaque île d'un archipel partirait d'une origine fausse — et la Corse
 *    atterrirait dans le Massif central.
 */
export function encodeRelativePath(d: string): string {
  if (!d) return '';

  const out: string[] = [];
  /* Position effectivement écrite, sur la grille entière. */
  let penX = 0;
  let penY = 0;
  /* Début du sous-tracé courant : la position où `z` ramènera le stylo. */
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

  /* d3-geo n'émet que M, L et Z pour des polygones. */
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

/** Rejoue un tracé relatif et renvoie ses sommets absolus. Sert au contrôle de fidélité du pipeline. */
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

/** Sommets absolus d'un tracé d3-geo, pour comparaison avec sa version encodée. */
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
