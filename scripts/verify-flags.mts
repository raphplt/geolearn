import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { pngSize } from './lib/png.mts';
import type { WorldAtlas } from '../src/data/types.ts';

const ROOT = join(import.meta.dirname, '..');
const FLAG_DIR = join(ROOT, 'assets', 'flags');
const TABLE = join(ROOT, 'src', 'data', 'flags.ts');

const WORLD = JSON.parse(
  readFileSync(join(ROOT, 'src', 'data', 'world-countries.json'), 'utf8'),
) as WorldAtlas;

let checks = 0;
let failures = 0;
const check = (ok: boolean, label: string, detail?: string): void => {
  checks++;
  if (ok) return;
  failures++;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

if (!existsSync(TABLE)) {
  console.error('\n  ✗ src/data/flags.ts absent — lancez `pnpm flags:build`\n');
  process.exit(1);
}
const source = readFileSync(TABLE, 'utf8');

type Entry = { cca2: string; file: string; width: number; height: number };
const entries = new Map<string, Entry>();
for (const [, cca2, file, width, height] of source.matchAll(
  /^ {2}([A-Z]{2}): \{ source: require\('\.\.\/\.\.\/(assets\/flags\/[a-z]{2}\.png)'\) as FlagSource, width: (\d+), height: (\d+) \},$/gm,
)) {
  entries.set(cca2!, {
    cca2: cca2!,
    file: file!,
    width: Number(width),
    height: Number(height),
  });
}

console.log(`\n▸ Table — ${entries.size} entrées`);
check(entries.size > 190, 'la table est peuplée', `${entries.size} entrées`);

console.log('\n▸ Couverture');
const playable = WORLD.territories.filter((c) => c.unMember);
const missing = playable.filter((c) => !entries.has(c.cca2));
check(
  missing.length === 0,
  `les ${playable.length} pays interrogeables ont leur drapeau`,
  missing.map((c) => `${c.cca2} ${c.name}`).join(', '),
);

const declared = WORLD.territories.filter((c) => /^[A-Z]{2}$/.test(c.cca2));
const uncovered = declared.filter((c) => !entries.has(c.cca2));
check(
  uncovered.length === 0,
  `les ${declared.length} codes des données sont couverts`,
  uncovered.map((c) => c.cca2).join(', '),
);

console.log('\n▸ Fichiers');
let bytes = 0;
let widest = { cca2: '', ratio: 0 };
let tallest = { cca2: '', ratio: Number.POSITIVE_INFINITY };

for (const entry of entries.values()) {
  const path = join(ROOT, entry.file);
  if (!existsSync(path)) {
    check(false, `${entry.cca2} — fichier absent`, entry.file);
    continue;
  }

  const buf = readFileSync(path);
  bytes += statSync(path).size;

  let size: { width: number; height: number };
  try {
    size = pngSize(buf);
  } catch (error) {
    check(false, `${entry.cca2} — PNG illisible`, (error as Error).message);
    continue;
  }

  check(
    size.width === entry.width && size.height === entry.height,
    `${entry.cca2} — dimensions conformes à la table`,
    `fichier ${size.width}×${size.height}, table ${entry.width}×${entry.height}`,
  );

  const ratio = size.width / size.height;
  if (ratio > widest.ratio) widest = { cca2: entry.cca2, ratio };
  if (ratio < tallest.ratio) tallest = { cca2: entry.cca2, ratio };
}

const onDisk = readdirSync(FLAG_DIR).filter((f) => f.endsWith('.png'));
check(
  onDisk.length === entries.size,
  'aucun fichier orphelin sur le disque',
  `${onDisk.length} fichiers pour ${entries.size} entrées`,
);

console.log(`  · ${(bytes / 1024).toFixed(0)} Ko embarqués`);
console.log(
  `  · rapports extrêmes : ${widest.cca2} ${widest.ratio.toFixed(2)}:1, ` +
    `${tallest.cca2} ${tallest.ratio.toFixed(2)}:1`,
);

check(
  widest.ratio / tallest.ratio > 2,
  'les rapports sont assez variés pour justifier la mesure par fichier',
  `${widest.ratio.toFixed(2)} contre ${tallest.ratio.toFixed(2)}`,
);

console.log('\n▸ Absence d’émojis dans le rendu');
function screensUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return screensUnder(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}
const rendered = screensUnder(join(ROOT, 'app'));
check(rendered.length >= 5, 'les écrans sont bien tous visités', `${rendered.length} trouvés`);
for (const file of rendered) {
  const text = readFileSync(file, 'utf8');
  check(!/\.flag\b/.test(text), `${file.slice(ROOT.length + 1)} n’affiche pas l’émoji des données`);
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures} / ${checks} contrôles passés\n`);
process.exit(failures === 0 ? 0 : 1);
