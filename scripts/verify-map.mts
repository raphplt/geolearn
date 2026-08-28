import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildHitIndex, decodePath, hitTest, pointInRings } from '../src/map/geometry.ts';
import type { FranceAtlas, WorldAtlas, Territory, Atlas } from '../src/data/types.ts';

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data');
const load = <T,>(name: string): T =>
  JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8')) as T;

let failures = 0;
let checks = 0;
const fail = (message: string): void => {
  failures++;
  console.error(`  ✗ ${message}`);
};

function verifyAtlas<T extends Territory>(atlas: Atlas<T>): void {
  console.log(`\n▸ ${atlas.name}`);
  const started = performance.now();
  const index = buildHitIndex(atlas);
  const buildMs = performance.now() - started;

  let rings = 0;
  let vertices = 0;
  for (const entry of index.entries) {
    rings += entry.rings.length;
    for (const ring of entry.rings) vertices += ring.length / 2;
  }
  console.log(
    `  · index construit en ${buildMs.toFixed(0)} ms — ${index.entries.length} contours, ${rings} anneaux, ${vertices.toLocaleString('fr-FR')} sommets`,
  );

  for (const t of atlas.territories) {
    if (!t.d) continue;
    checks++;
    if (decodePath(t.d).length === 0) fail(`${t.id} (${t.name}) : tracé non décodable en anneaux`);
  }

  const misses: string[] = [];
  for (const t of atlas.territories) {
    if (!t.d) continue;
    checks++;
    const hit = hitTest(index, t.label[0], t.label[1]);
    if (hit !== t.id) misses.push(`${t.id} ${t.name} → ${hit ?? 'aucun'}`);
  }
  if (misses.length > 0) {
    fail(`ancre d'étiquette mal attribuée pour ${misses.length} territoire(s) :`);
    for (const m of misses.slice(0, 12)) console.error(`      ${m}`);
    if (misses.length > 12) console.error(`      … et ${misses.length - 12} de plus`);
  }

  for (const t of atlas.territories.slice(0, 40)) {
    if (!t.d) continue;
    checks++;
    const entry = index.entries.find((e) => e.id === t.id);
    if (!entry) {
      fail(`${t.id} absent de l'index`);
      continue;
    }
    if (!pointInRings(t.label[0], t.label[1], entry.rings)) {
      fail(`${t.id} (${t.name}) : l'ancre n'est pas dans ses propres anneaux`);
    }
  }

  checks++;
  if (hitTest(index, -9999, -9999) !== null) fail('un point hors atlas désigne un territoire');

  checks++;
  const farAway = hitTest(index, -5000, -5000, { tolerance: 100 });
  if (farAway !== null) fail(`rattrapage hors tolérance : ${farAway}`);

  const samples = atlas.territories.filter((t) => t.d).slice(0, 200);
  const t0 = performance.now();
  for (const t of samples) hitTest(index, t.label[0], t.label[1], { tolerance: 60 });
  const perHit = (performance.now() - t0) / samples.length;
  console.log(`  · pointé moyen : ${perHit.toFixed(2)} ms`);
  checks++;
  if (perHit > 8) fail(`pointé trop lent : ${perHit.toFixed(2)} ms par toucher`);
}

const france = load<FranceAtlas>('france-departments.json');
const world = load<WorldAtlas>('world-countries.json');

console.log('Vérification du moteur de carte');
verifyAtlas(france);
verifyAtlas(world);

console.log('\n▸ Recoupement chefs-lieux × contours');
const index = buildHitIndex(france);
const wrong: string[] = [];
for (const d of france.territories) {
  checks++;
  const hit = hitTest(index, d.prefecturePoint[0], d.prefecturePoint[1], { tolerance: 30 });
  if (hit !== d.id) wrong.push(`${d.prefecture} (${d.id}) → ${hit ?? 'aucun'}`);
}
if (wrong.length > 0) {
  fail(`${wrong.length} chef(s)-lieu hors de leur département :`);
  for (const w of wrong) console.error(`      ${w}`);
} else {
  console.log('  · les 101 chefs-lieux tombent dans leur département');
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures} / ${checks} contrôles passés\n`);
process.exit(failures === 0 ? 0 : 1);
