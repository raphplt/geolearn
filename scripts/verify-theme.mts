import { INK_PALETTES, withInk } from '../src/theme/inks.ts';
import { colorSchemes, type ColorScheme, type Colors } from '../src/theme/tokens.ts';
import { INKS, type InkId } from '../src/game/economy.ts';

function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`couleur non mesurable : ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05);
}

type Role = keyof Colors;

type Rule = {
  fg: Role;
  bg: Role;
  min: number | Record<ColorScheme, number>;
  why: string;
};

const rules: Rule[] = [
  { fg: 'text', bg: 'canvas', min: 7, why: 'texte principal sur le fond' },
  { fg: 'text', bg: 'surface', min: 7, why: 'texte principal sur une surface' },
  { fg: 'text', bg: 'surfaceRaised', min: 7, why: 'texte principal sur une feuille posée' },
  { fg: 'textSecondary', bg: 'canvas', min: 4.5, why: 'texte secondaire sur le fond' },
  { fg: 'textSecondary', bg: 'surfaceRaised', min: 4.5, why: 'texte secondaire sur une feuille' },
  { fg: 'textTertiary', bg: 'canvas', min: 4.5, why: 'cartouches et légendes sur le fond' },
  { fg: 'textTertiary', bg: 'surface', min: 4.5, why: 'cartouches et légendes sur une surface' },
  {
    fg: 'textTertiary',
    bg: 'surfaceRaised',
    min: 4.5,
    why: 'cartouches et légendes sur une feuille',
  },
  { fg: 'textQuiet', bg: 'canvas', min: 1.9, why: 'filigrane — décoratif, mais visible' },
  { fg: 'textInverse', bg: 'text', min: 7, why: 'libellé d’un bouton primaire' },

  { fg: 'surfaceRaised', bg: 'canvas', min: 1.22, why: 'une feuille posée se détache du fond' },
  { fg: 'surfaceSunk', bg: 'canvas', min: 1.12, why: 'une surface creusée s’enfonce dans le fond' },
  {
    fg: 'surfaceRaised',
    bg: 'surfaceSunk',
    min: 1.45,
    why: 'jauge : le remplissage contre sa gorge',
  },

  {
    fg: 'borderStrong',
    bg: 'surfaceRaised',
    min: { light: 3, dark: 2.4 },
    why: 'contour d’un composant tactile (WCAG 1.4.11)',
  },
  {
    fg: 'borderStrong',
    bg: 'canvas',
    min: { light: 3, dark: 2.6 },
    why: 'contour tactile sur le fond',
  },
  {
    fg: 'border',
    bg: 'surfaceRaised',
    min: { light: 2.2, dark: 1.4 },
    why: 'bord d’une feuille posée',
  },
  {
    fg: 'border',
    bg: 'canvas',
    min: { light: 2.2, dark: 1.5 },
    why: 'bord d’une feuille sur le fond',
  },
  { fg: 'borderSoft', bg: 'surfaceRaised', min: 1.2, why: 'filet décoratif' },

  { fg: 'danger', bg: 'canvas', min: 3, why: 'jauge de temps sur le fond' },
  { fg: 'danger', bg: 'surfaceSunk', min: 3, why: 'jauge de temps dans sa gorge' },
  { fg: 'success', bg: 'canvas', min: 3, why: 'barre de progression sur le fond' },
  { fg: 'success', bg: 'surfaceSunk', min: 3, why: 'barre de progression dans sa gorge' },
  { fg: 'reward', bg: 'canvas', min: 3, why: 'pastille de série sur le fond' },
  { fg: 'reward', bg: 'surfaceRaised', min: 3, why: 'pastille de série sur une feuille' },

  { fg: 'text', bg: 'successSoft', min: 7, why: 'texte sur l’aplat d’une bonne réponse' },
  { fg: 'text', bg: 'dangerSoft', min: 7, why: 'texte sur l’aplat d’une erreur' },
  { fg: 'text', bg: 'rewardSoft', min: 7, why: 'texte sur l’aplat d’une récompense' },
  { fg: 'success', bg: 'successSoft', min: 3, why: 'liseré d’une bonne réponse' },
  { fg: 'danger', bg: 'dangerSoft', min: 3, why: 'liseré d’une erreur' },
  { fg: 'reward', bg: 'rewardSoft', min: 3, why: 'liseré d’une récompense' },
  { fg: 'textOnAccent', bg: 'danger', min: 4.5, why: 'libellé sur un bouton de danger' },
  { fg: 'info', bg: 'surfaceRaised', min: 4.5, why: 'lien d’action sur une feuille' },

  { fg: 'dangerDeep', bg: 'danger', min: 1.6, why: 'tranche d’un bouton vermillon' },
  { fg: 'successDeep', bg: 'success', min: 1.6, why: 'tranche d’un bouton vert-de-gris' },
  { fg: 'rewardDeep', bg: 'reward', min: 1.6, why: 'tranche d’un bouton de laiton' },
  { fg: 'textOnAccent', bg: 'success', min: 4.5, why: 'libellé sur un bouton vert-de-gris' },
  { fg: 'textOnAccent', bg: 'reward', min: 4.5, why: 'libellé sur un bouton de laiton' },

  { fg: 'mapLandIdle', bg: 'mapWater', min: 1.8, why: 'terre au repos contre la mer' },
  { fg: 'mapStrokeStrong', bg: 'mapLandIdle', min: 3, why: 'trait de côte côté terre' },
  { fg: 'mapStrokeStrong', bg: 'mapWater', min: 3, why: 'trait de côte côté mer' },
  { fg: 'mapStroke', bg: 'mapLandIdle', min: 2, why: 'frontières intérieures' },
  {
    fg: 'mapLand',
    bg: 'mapLandIdle',
    min: 2.4,
    why: 'territoire acquis contre territoire inconnu',
  },
  { fg: 'mapTarget', bg: 'mapLandIdle', min: 1.5, why: 'territoire en jeu contre les autres' },
  { fg: 'mapTarget', bg: 'mapLand', min: 1.6, why: 'territoire en cours contre territoire acquis' },
  { fg: 'mapCorrect', bg: 'mapLandIdle', min: 1.9, why: 'bonne réponse sur la carte' },
  { fg: 'mapWrong', bg: 'mapLandIdle', min: 1.9, why: 'erreur sur la carte' },
  { fg: 'mapWrong', bg: 'mapTarget', min: 1.35, why: 'ce qu’on a désigné contre la bonne réponse' },
  { fg: 'mapLabel', bg: 'mapLabelHalo', min: 7, why: 'étiquette contre son halo' },
  { fg: 'mapLabelHalo', bg: 'mapLand', min: 1.9, why: 'halo d’étiquette sur un territoire acquis' },
  {
    fg: 'mapLabelHalo',
    bg: 'mapLandIdle',
    min: 1.1,
    why: 'halo d’étiquette sur un territoire au repos',
  },
  {
    fg: 'mapGraticule',
    bg: 'mapWater',
    min: 1.12,
    why: 'graticule sur la mer — se devine, ne se lit pas',
  },
];

let checks = 0;
let failures = 0;

const fr = (n: number): string => `${n.toFixed(2).replace('.', ',')}:1`;

for (const scheme of ['light', 'dark'] as ColorScheme[]) {
  const colors = colorSchemes[scheme];
  console.log(`\n▸ Thème ${scheme === 'light' ? 'clair' : 'nuit'}`);

  for (const rule of rules) {
    const min = typeof rule.min === 'number' ? rule.min : rule.min[scheme];
    const ratio = contrast(colors[rule.fg], colors[rule.bg]);
    checks++;

    if (ratio + 1e-9 < min) {
      failures++;
      console.error(
        `  ✗ ${fr(ratio).padStart(8)} < ${fr(min).padEnd(7)} ${rule.fg} / ${rule.bg} — ${rule.why}`,
      );
    } else if (process.argv.includes('--verbose')) {
      console.log(
        `  · ${fr(ratio).padStart(8)} ≥ ${fr(min).padEnd(7)} ${rule.fg} / ${rule.bg} — ${rule.why}`,
      );
    }
  }
}

const mapRules = rules.filter((rule) => rule.fg.startsWith('map') && rule.bg.startsWith('map'));

for (const ink of INKS) {
  if (ink.id === 'sepia') continue;
  console.log(`\n▸ Encre « ${ink.name} »`);
  for (const scheme of ['light', 'dark'] as ColorScheme[]) {
    const colors = withInk(colorSchemes[scheme], scheme, ink.id);
    for (const rule of mapRules) {
      const min = typeof rule.min === 'number' ? rule.min : rule.min[scheme];
      const ratio = contrast(colors[rule.fg], colors[rule.bg]);
      checks++;
      if (ratio + 1e-9 < min) {
        failures++;
        console.error(
          `  ✗ ${scheme === 'light' ? 'clair' : 'nuit'} ${fr(ratio).padStart(8)} < ${fr(min).padEnd(7)} ${rule.fg} / ${rule.bg} — ${rule.why}`,
        );
      }
    }
  }
}

for (const [id, schemes] of Object.entries(INK_PALETTES) as [
  InkId,
  Record<ColorScheme, Record<string, string>>,
][]) {
  for (const scheme of ['light', 'dark'] as ColorScheme[]) {
    for (const role of Object.keys(schemes[scheme])) {
      checks++;
      if (!role.startsWith('map')) {
        failures++;
        console.error(`  ✗ l’encre « ${id} » redéfinit ${role}, qui n’appartient pas à la carte`);
      }
    }
  }
}

const TRANSLUCENT: Role[] = ['scrim', 'bevel'];
console.log('\n▸ Intégrité des jetons');
for (const scheme of ['light', 'dark'] as ColorScheme[]) {
  for (const [role, value] of Object.entries(colorSchemes[scheme]) as [Role, string][]) {
    if (TRANSLUCENT.includes(role)) continue;
    checks++;
    try {
      luminance(value);
    } catch {
      failures++;
      console.error(`  ✗ ${scheme}.${role} = ${value} — attendu #RRGGBB opaque`);
    }
  }
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures} / ${checks} contrôles passés\n`);
process.exit(failures === 0 ? 0 : 1);
