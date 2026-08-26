/**
 * Génère les assets bitmap de l'application.
 *
 *   pnpm assets:build
 *
 * Deux familles :
 *
 *  · Les **textures de papier**, produites pixel par pixel. Un `feTurbulence`
 *    SVG aurait été plus élégant, mais react-native-svg n'en fournit pas
 *    d'implémentation native : le filtre existe côté JS et ne rend rien sur
 *    l'appareil. On précalcule donc le grain.
 *
 *  · Les **icônes**, rasterisées depuis la géométrie de la rose des vents
 *    partagée avec l'application, pour que la marque du magasin et celle de
 *    l'écran d'accueil soient rigoureusement la même.
 */
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
/** Plus clair que le disque : c'est ce qui rend lisible la fente des branches. */
const PAPER_HIGHLIGHT = '#FFFBF2';
const INK_HEX = '#241A12';
const INK_SOFT = '#6B5340';
const VERMILION = '#C4452D';
const BRASS = '#C9932A';

/* ───────────────────────── Textures ───────────────────────── */

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Grain de papier, encodé en **alpha** sur une couleur d'encre constante.
 *
 * React Native n'expose pas de mode de fusion « multiply » portable sur les
 * images. Plutôt que d'y renoncer, on encode l'intensité du grain dans le canal
 * alpha d'un aplat d'encre : superposée telle quelle, la texture assombrit là
 * où le grain est dense — ce qui est exactement l'effet d'un multiply, obtenu
 * avec un simple alpha-blending disponible partout.
 */
function paperGrain(size: number, seed: number): Buffer {
  const mottle = fbm(size, { octaves: 4, baseCells: 4, gain: 0.55, seed });
  const fibre = fbm(size, { octaves: 3, baseCells: 32, gain: 0.5, seed: seed + 101 });
  const speckle = whiteNoise(size, seed + 202);
  const rand = mulberry32(seed + 303);

  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    /* Trois échelles superposées : l'irrégularité de la pâte, l'orientation des
       fibres, et le grain pixel qui empêche la surface de paraître lissée. */
    let a = 0;
    a += (mottle[i]! - 0.5) * 0.55;
    a += (fibre[i]! - 0.5) * 0.35;
    a += (speckle[i]! - 0.5) * 0.22;
    a = clamp01(a + 0.5);

    /* Courbe de contraste : on ne garde que la moitié sombre de la
       distribution, sinon la texture éclaircit le papier au lieu de le patiner. */
    let alpha = Math.max(0, a - 0.5) * 2;
    alpha = alpha ** 1.6 * 26;

    /* Quelques inclusions rares — les points sombres du papier chiffon. */
    if (rand() < 0.0009) alpha += 22 + rand() * 26;

    const o = i * 4;
    rgba[o] = INK.r;
    rgba[o + 1] = INK.g;
    rgba[o + 2] = INK.b;
    rgba[o + 3] = Math.min(255, Math.round(alpha));
  }
  return encodePng(size, size, rgba);
}

/** Variante nuit : le grain éclaircit au lieu d'assombrir, sinon il disparaît sur fond sombre. */
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

/* ───────────────────────── Marque ───────────────────────── */

/**
 * @param withPlate Fond de parchemin et couronne graduée. Faux pour l'icône
 *                  adaptative Android, dont le fond est peint par le système.
 */
function markSvg(size: number, { withPlate = true, bleed = 1, points = 8 as 8 | 16 } = {}): string {
  const cx = size / 2;
  const cy = size / 2;
  /* `bleed` réserve la marge de sécurité : Android rogne l'icône adaptative
     en cercle, et une rose plein cadre y perdrait ses pointes. */
  const r = (size / 2) * bleed;

  const branches = roseBranches(points, { cx, cy, radius: r * 0.82, hub: 0.3 });
  const ticks = roseTicks({ cx, cy, radius: r * 0.95, long: r * 0.06, short: r * 0.032 });
  const stroke = size / 340;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
  ];

  if (withPlate) {
    /* Le disque est plus **sombre** que le fond, et non plus clair : c'est lui
       qui doit servir de repoussoir aux moitiés claires des branches. Peindre
       le disque et les branches claires de la même teinte — l'erreur commise
       d'abord — efface purement et simplement la moitié du relief. */
    parts.push(
      `<rect width="${size}" height="${size}" fill="${PARCHMENT_LIGHT}"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.99}" fill="${PARCHMENT}"/>`,
    );
  }

  /* Trame de rhumbs, très en retrait : elle doit se deviner, pas se lire. */
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

  /* Rangs inférieurs d'abord : les cardinales doivent passer devant. */
  for (const branch of [...branches].sort((a, b) => b.rank - a.rank)) {
    /* Seul le nord est en vermillon. Colorer les quatre cardinales ferait un
       moulin à vent ; n'en marquer qu'une donne une orientation à la marque. */
    const isNorth = branch.angle === 0;
    parts.push(
      `<path d="${branch.dark}" fill="${isNorth ? '#8E2E1C' : INK_HEX}" stroke="${INK_HEX}" stroke-width="${stroke * 1.2}" stroke-linejoin="round"/>`,
      `<path d="${branch.light}" fill="${isNorth ? VERMILION : PAPER_HIGHLIGHT}" stroke="${INK_HEX}" stroke-width="${stroke * 1.6}" stroke-linejoin="round"/>`,
    );
  }

  /* Moyeu : un disque de laiton cerné d'encre. */
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

/* ───────────────────────── Exécution ───────────────────────── */

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
  /* Huit branches et non seize : une icône se regarde à 60 px sur un écran
     d'accueil, taille à laquelle les branches secondaires se referment en une
     tache grise. La rose à seize pointes est réservée au décor de l'application,
     où elle occupe la moitié de l'écran. */
  ['icon.png', 1024, { withPlate: true, bleed: 0.88, points: 8 }],
  /* Android rogne l'icône adaptative en cercle sur 66 % de sa surface : la rose
     doit tenir dans cette zone sûre, et le fond est peint par le système. */
  ['adaptive-icon.png', 1024, { withPlate: false, bleed: 0.58, points: 8 }],
  ['splash.png', 512, { withPlate: false, bleed: 0.94, points: 16 }],
  /* À 64 px, les huit branches secondaires se referment en tache : rose simple. */
  ['favicon.png', 64, { withPlate: true, bleed: 0.9, points: 8 }],
];

for (const [name, size, opts] of icons) {
  rasterize(markSvg(size, opts), join(ASSETS, name), size);
  console.log(`  ✓ ${name} (${size}px)`);
}

/* Une planche de contrôle, pour juger la marque en grand. */
writeFileSync(
  join(ASSETS, '.preview-mark.svg'),
  markSvg(600, { withPlate: true, bleed: 0.88, points: 16 }),
);
console.log('\nTerminé.\n');
