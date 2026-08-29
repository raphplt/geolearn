import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FranceAtlas, WorldAtlas, Territory } from '../src/data/types.ts';

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data');
const outDir = process.argv[2] ?? join(import.meta.dirname, '.cache', 'preview');

const C = {
  paper: '#F6EBD8',
  paperRaised: '#FCF4E5',
  land: '#EADCC2',
  ink: '#241A12',
  stroke: '#A89170',
  water: '#CFE2E0',
  graticule: '#C9B287',
  vermilion: '#C4452D',
  verdigris: '#2E7D6B',
  brass: '#C9932A',
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderAtlas(
  atlas: FranceAtlas | WorldAtlas,
  opts: { showLabels: boolean; showAnchors: boolean; showPrefectures: boolean },
): string {
  const { width, height } = atlas;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="${C.paper}"/>`);

  if (atlas.outline) {
    parts.push(
      `<path d="${atlas.outline}" fill="none" stroke="${C.water}" stroke-width="26" stroke-linejoin="round" opacity="0.9"/>`,
      `<path d="${atlas.outline}" fill="none" stroke="${C.water}" stroke-width="52" stroke-linejoin="round" opacity="0.45"/>`,
    );
  }
  if (atlas.graticule) {
    parts.push(
      `<path d="${atlas.graticule}" fill="none" stroke="${C.graticule}" stroke-width="2" opacity="0.5"/>`,
    );
  }

  for (const inset of atlas.insets) {
    const [x0, y0, x1, y1] = inset.frame;
    parts.push(
      `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${C.paperRaised}" stroke="${C.stroke}" stroke-width="3" rx="10"/>`,
      `<text x="${x0 + 12}" y="${y1 - 14}" font-family="Georgia,serif" font-size="34" fill="${C.ink}" opacity="0.65">${esc(inset.label)}</text>`,
    );
  }

  for (const t of atlas.territories as Territory[]) {
    if (!t.d) continue;
    parts.push(
      `<path d="${t.d}" fill="${C.land}" stroke="${C.stroke}" stroke-width="2.5" stroke-linejoin="round"/>`,
    );
  }

  if (opts.showAnchors) {
    for (const t of atlas.territories as Territory[]) {
      parts.push(
        `<circle cx="${t.label[0]}" cy="${t.label[1]}" r="7" fill="${C.vermilion}" opacity="0.85"/>`,
      );
    }
  }

  if (opts.showPrefectures && 'territories' in atlas) {
    for (const t of atlas.territories as { prefecturePoint?: [number, number] }[]) {
      if (!t.prefecturePoint) continue;
      const [x, y] = t.prefecturePoint;
      parts.push(`<circle cx="${x}" cy="${y}" r="5" fill="${C.verdigris}"/>`);
    }
  }

  if (opts.showLabels) {
    for (const t of atlas.territories as Territory[]) {
      if (t.area < (atlas.width / 100) ** 2) continue;
      parts.push(
        `<text x="${t.label[0]}" y="${t.label[1]}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-size="26" fill="${C.ink}" opacity="0.8">${esc(t.name)}</text>`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function load<T>(name: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8')) as T;
}

mkdirSync(outDir, { recursive: true });

const france = load<FranceAtlas>('france-departments.json');
const world = load<WorldAtlas>('world-countries.json');

const outputs: [string, string][] = [
  [
    'france-plain.svg',
    renderAtlas(france, { showLabels: false, showAnchors: false, showPrefectures: false }),
  ],
  [
    'france-annotated.svg',
    renderAtlas(france, { showLabels: true, showAnchors: true, showPrefectures: true }),
  ],
  [
    'world-plain.svg',
    renderAtlas(world, { showLabels: false, showAnchors: false, showPrefectures: false }),
  ],
  [
    'world-annotated.svg',
    renderAtlas(world, { showLabels: true, showAnchors: true, showPrefectures: false }),
  ],
];

for (const [name, svg] of outputs) {
  writeFileSync(join(outDir, name), svg);
  console.log(`  ✓ ${name}`);
}
console.log(`\nAperçus écrits dans ${outDir}`);
