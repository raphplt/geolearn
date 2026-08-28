import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import { fbm, whiteNoise, mulberry32 } from './lib/noise.mts';
import { encodePng } from './lib/png.mts';
import { rhumbLines, roseBranches, roseTicks } from '../src/ui/brand/rose-geometry.ts';

const ASSETS = join(import.meta.dirname, '..', 'assets');

const INK = { r: 0x24, g: 0x1a, b: 0x12 };
const PARCHMENT = '#F6EBD8';
const PARCHMENT_LIGHT = '#FCF4E5';
const PAPER_HIGHLIGHT = '#FFFBF2';
const INK_HEX = '#241A12';
const INK_SOFT = '#6B5340';
const VERMILION = '#C4452D';
const BRASS = '#C9932A';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function paperGrain(size: number, seed: number): Buffer {
  const mottle = fbm(size, { octaves: 4, baseCells: 4, gain: 0.55, seed });
  const fibre = fbm(size, { octaves: 3, baseCells: 32, gain: 0.5, seed: seed + 101 });
  const speckle = whiteNoise(size, seed + 202);
  const rand = mulberry32(seed + 303);

  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    let a = 0;
    a += (mottle[i]! - 0.5) * 0.55;
    a += (fibre[i]! - 0.5) * 0.35;
    a += (speckle[i]! - 0.5) * 0.22;
    a = clamp01(a + 0.5);

    let alpha = Math.max(0, a - 0.5) * 2;
    alpha = alpha ** 1.6 * 26;

    if (rand() < 0.0009) alpha += 22 + rand() * 26;

    const o = i * 4;
    rgba[o] = INK.r;
    rgba[o + 1] = INK.g;
    rgba[o + 2] = INK.b;
    rgba[o + 3] = Math.min(255, Math.round(alpha));
  }
  return encodePng(size, size, rgba);
}

function paperGrainDark(size: number, seed: number): Buffer {
  const mottle = fbm(size, { octaves: 4, baseCells: 4, gain: 0.55, seed });
  const speckle = whiteNoise(size, seed + 202);

  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    let a = clamp01((mottle[i]! - 0.5) * 0.7 + (speckle[i]! - 0.5) * 0.3 + 0.5);
    let alpha = Math.max(0, a - 0.52) * 2;
    alpha = alpha ** 1.8 * 16;

    const o = i * 4;
    rgba[o] = 0xef;
    rgba[o + 1] = 0xe2;
    rgba[o + 2] = 0xcb;
    rgba[o + 3] = Math.min(255, Math.round(alpha));
  }
  return encodePng(size, size, rgba);
}

function markSvg(size: number, { withPlate = true, bleed = 1, points = 8 as 8 | 16 } = {}): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) * bleed;

  const branches = roseBranches(points, { cx, cy, radius: r * 0.82, hub: 0.3 });
  const ticks = roseTicks({ cx, cy, radius: r * 0.95, long: r * 0.06, short: r * 0.032 });
  const stroke = size / 340;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
  ];

  if (withPlate) {
    parts.push(
      `<rect width="${size}" height="${size}" fill="${PARCHMENT_LIGHT}"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.99}" fill="${PARCHMENT}"/>`,
    );
  }

  parts.push(
    `<path d="${rhumbLines(cx, cy, r * 0.9, 32)}" stroke="${INK_SOFT}" stroke-width="${stroke * 0.7}" fill="none" opacity="0.14"/>`,
  );

  if (withPlate) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.95}" fill="none" stroke="${INK_SOFT}" stroke-width="${stroke * 1.8}" opacity="0.5"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.87}" fill="none" stroke="${INK_SOFT}" stroke-width="${stroke * 0.8}" opacity="0.35"/>`,
    );
    for (const tick of ticks) {
      parts.push(
        `<path d="${tick.d}" stroke="${INK_SOFT}" stroke-width="${tick.major ? stroke * 2 : stroke}" opacity="${tick.major ? 0.62 : 0.36}" stroke-linecap="round"/>`,
      );
    }
  }

  for (const branch of [...branches].sort((a, b) => b.rank - a.rank)) {
    const isNorth = branch.angle === 0;
    parts.push(
      `<path d="${branch.dark}" fill="${isNorth ? '#8E2E1C' : INK_HEX}" stroke="${INK_HEX}" stroke-width="${stroke * 1.2}" stroke-linejoin="round"/>`,
      `<path d="${branch.light}" fill="${isNorth ? VERMILION : PAPER_HIGHLIGHT}" stroke="${INK_HEX}" stroke-width="${stroke * 1.6}" stroke-linejoin="round"/>`,
    );
  }

  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.062}" fill="${BRASS}" stroke="${INK_HEX}" stroke-width="${stroke * 1.4}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.022}" fill="${INK_HEX}"/>`,
    '</svg>',
  );

  return parts.join('');
}

function rasterize(svg: string, out: string, size: number): void {
  const tmp = join(ASSETS, '.tmp.svg');
  writeFileSync(tmp, svg);
  try {
    execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), tmp, '-o', out]);
  } finally {
    unlinkSync(tmp);
  }
}

mkdirSync(ASSETS, { recursive: true });

const emit = (name: string, buf: Buffer): void => {
  writeFileSync(join(ASSETS, name), buf);
  console.log(`  ✓ ${name} — ${(buf.length / 1024).toFixed(0)} Ko`);
};

console.log('Génération des assets Portulan\n▸ Textures');
emit('paper-grain.png', paperGrain(512, 7));
emit('paper-grain-dark.png', paperGrainDark(512, 11));

console.log('\n▸ Marque');
try {
  execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('  ! rsvg-convert introuvable — icônes non régénérées (assets existants conservés)');
  process.exit(0);
}

const icons: [string, number, Parameters<typeof markSvg>[1]][] = [
  ['icon.png', 1024, { withPlate: true, bleed: 0.88, points: 8 }],
  ['adaptive-icon.png', 1024, { withPlate: false, bleed: 0.58, points: 8 }],
  ['splash.png', 512, { withPlate: false, bleed: 0.94, points: 16 }],
  ['favicon.png', 64, { withPlate: true, bleed: 0.9, points: 8 }],
];

for (const [name, size, opts] of icons) {
  rasterize(markSvg(size, opts), join(ASSETS, name), size);
  console.log(`  ✓ ${name} (${size}px)`);
}

writeFileSync(
  join(ASSETS, '.preview-mark.svg'),
  markSvg(600, { withPlate: true, bleed: 0.88, points: 16 }),
);
console.log('\nTerminé.\n');
