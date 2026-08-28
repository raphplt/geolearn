import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { decodePath } from '../src/map/geometry.ts';
import { dissolveRings } from './lib/geo-utils.mts';
import type { Atlas, Territory } from '../src/data/types.ts';

const DATA = join(import.meta.dirname, '..', 'src', 'data');

function ringsOfAtlas(atlas: Atlas<Territory>): [number, number][][] {
  const rings: [number, number][][] = [];
  for (const territory of atlas.territories) {
    if (!territory.d) continue;
    for (const flat of decodePath(territory.d)) {
      const ring: [number, number][] = [];
      for (let i = 0; i < flat.length; i += 2) ring.push([flat[i]!, flat[i + 1]!]);
      if (ring.length >= 3) rings.push(ring);
    }
  }
  return rings;
}

for (const file of ['world-countries.json']) {
  const path = join(DATA, file);
  const atlas = JSON.parse(readFileSync(path, 'utf8')) as Atlas<Territory> & { frame?: string };

  const rings = ringsOfAtlas(atlas);
  const before = atlas.outline;
  const outline = dissolveRings(rings);

  const frame = before;

  atlas.outline = outline;
  atlas.frame = frame;

  writeFileSync(path, `${JSON.stringify(atlas)}\n`);

  const decoded = decodePath(outline);
  let vertices = 0;
  for (const ring of decoded) vertices += ring.length / 2;
  console.log(
    `${file}\n` +
      `  · ${rings.length} anneaux fondus en ${decoded.length} — ${vertices.toLocaleString('fr-FR')} sommets\n` +
      `  · silhouette ${(outline.length / 1024).toFixed(0)} Ko, cadre ${(frame.length / 1024).toFixed(1)} Ko\n` +
      `  · avant : ${(before.length / 1024).toFixed(1)} Ko (la sphère, à tort)`,
  );
}
