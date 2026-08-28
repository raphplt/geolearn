import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { fetchCachedBuffer, mapLimit } from './lib/fetch-cache.mts';
import { pngSize } from './lib/png.mts';
import type { WorldAtlas } from '../src/data/types.ts';
import worldCountries from '../src/data/world-countries.json' with { type: 'json' };

const WORLD = worldCountries as unknown as WorldAtlas;

const FLAG_DIR = join(import.meta.dirname, '..', 'assets', 'flags');
const OUT_FILE = join(import.meta.dirname, '..', 'src', 'data', 'flags.ts');

const WIDTH = 320;

const url = (cca2: string): string => `https://flagcdn.com/w${WIDTH}/${cca2.toLowerCase()}.png`;

const countries = WORLD.territories
  .filter((c) => /^[A-Z]{2}$/.test(c.cca2))
  .sort((a, b) => a.cca2.localeCompare(b.cca2));

console.log(`Drapeaux — ${countries.length} territoires, largeur ${WIDTH} px\n`);

rmSync(FLAG_DIR, { recursive: true, force: true });
mkdirSync(FLAG_DIR, { recursive: true });

type Entry = { cca2: string; name: string; width: number; height: number; bytes: number };

const failures: string[] = [];

const entries = await mapLimit(countries, 8, async (country): Promise<Entry | null> => {
  try {
    const buf = await fetchCachedBuffer(url(country.cca2), `flag-${WIDTH}-${country.cca2}`);
    const { width, height } = pngSize(buf);
    writeFileSync(join(FLAG_DIR, `${country.cca2.toLowerCase()}.png`), buf);
    return { cca2: country.cca2, name: country.name, width, height, bytes: buf.length };
  } catch (error) {
    failures.push(`${country.cca2} (${country.name}) — ${(error as Error).message}`);
    return null;
  }
});

const found = entries.filter((e): e is Entry => e !== null);
const total = found.reduce((sum, e) => sum + e.bytes, 0);

if (failures.length > 0) {
  console.error(`  ! ${failures.length} drapeau(x) manquant(s) :`);
  for (const line of failures) console.error(`    · ${line}`);
}

const heaviest = [...found].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
console.log(`  ✓ ${found.length} fichiers — ${(total / 1024).toFixed(0)} Ko au total`);
console.log(
  `  · les plus lourds : ${heaviest.map((e) => `${e.cca2} ${(e.bytes / 1024).toFixed(1)} Ko`).join(', ')}`,
);

const lines = found.map(
  (e) =>
    `  ${e.cca2}: { source: require('../../assets/flags/${e.cca2.toLowerCase()}.png') as FlagSource, width: ${e.width}, height: ${e.height} },`,
);

const module = `export type FlagSource = number;

export type FlagAsset = {
  source: FlagSource;
  width: number;
  height: number;
};

export const FLAGS: Record<string, FlagAsset> = {
${lines.join('\n')}
};

export const flagOf = (cca2: string | undefined): FlagAsset | null =>
  (cca2 ? FLAGS[cca2.toUpperCase()] : undefined) ?? null;

export const FLAG_ATTRIBUTION =
  'Drapeaux : flagcdn.com, d’après lipis/flag-icons (licence MIT).';
`;

writeFileSync(OUT_FILE, module);
console.log(`  ✓ src/data/flags.ts — ${found.length} entrées`);

const onDisk = readdirSync(FLAG_DIR).length;
if (onDisk !== found.length) {
  console.error(`  ✗ ${onDisk} fichiers sur disque pour ${found.length} entrées`);
  process.exit(1);
}

console.log('\nTerminé.\n');
if (failures.length > 0) process.exit(1);
