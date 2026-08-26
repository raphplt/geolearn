/**
 * Portulan — design tokens.
 *
 * Direction artistique : « cartographie néo-rétro ».
 * Une carte portulan médiévale : parchemin vieilli, encre sépia, lignes de rhumb
 * rayonnant d'une rose des vents, rehauts vermillon (frontières, routes) et
 * vert-de-gris (mers, validation), dorure réservée aux éléments précieux.
 *
 * Règle d'usage des accents :
 *   vermilion  → erreur, urgence, temps qui s'écoule
 *   verdigris  → succès, territoire maîtrisé
 *   brass      → récompense, série (streak), rareté
 *   sea        → surfaces d'eau, éléments passifs de la carte
 */

export const palette = {
  parchment: {
    100: '#FDF8EE',
    200: '#FCF4E5',
    300: '#F6EBD8',
    400: '#EADCC2',
    500: '#DCC9A6',
    600: '#C9B287',
  },
  ink: {
    900: '#241A12',
    800: '#33261A',
    700: '#4A382A',
    500: '#7A6249',
    300: '#A89170',
    100: '#CBB894',
  },
  vermilion: {
    100: '#F7DED6',
    300: '#E08A73',
    500: '#C4452D',
    600: '#A5341F',
    700: '#7E2415',
  },
  verdigris: {
    100: '#D6E7E2',
    300: '#6BAA99',
    500: '#2E7D6B',
    600: '#1F5F51',
    700: '#14453A',
  },
  brass: {
    100: '#F7EACA',
    300: '#E3BE6B',
    500: '#C9932A',
    600: '#A87716',
    700: '#7D580F',
  },
  sea: {
    100: '#E2EFED',
    200: '#CFE2E0',
    500: '#9FC4C0',
    700: '#5E8B87',
  },
  indigo: {
    100: '#DCE4EE',
    500: '#3B5A7A',
    700: '#25405C',
  },
  night: {
    100: '#33424E',
    200: '#2A3742',
    300: '#1F2A33',
    400: '#1A232B',
    500: '#12191F',
    600: '#0C1116',
  },
} as const;

export type ColorScheme = 'light' | 'dark';

const lightColors = {
  /* Surfaces — du plus profond au plus élevé */
  canvas: palette.parchment[300],
  surface: palette.parchment[200],
  surfaceRaised: palette.parchment[100],
  surfaceSunk: palette.parchment[400],
  border: palette.parchment[500],
  borderStrong: palette.ink[100],
  scrim: 'rgba(36, 26, 18, 0.55)',

  /* Texte */
  text: palette.ink[900],
  textSecondary: palette.ink[500],
  textTertiary: palette.ink[300],
  textInverse: palette.parchment[100],
  textOnAccent: palette.parchment[100],

  /* Accents sémantiques */
  danger: palette.vermilion[500],
  dangerStrong: palette.vermilion[600],
  dangerSoft: palette.vermilion[100],
  success: palette.verdigris[500],
  successStrong: palette.verdigris[600],
  successSoft: palette.verdigris[100],
  reward: palette.brass[500],
  rewardStrong: palette.brass[600],
  rewardSoft: palette.brass[100],
  info: palette.indigo[500],
  infoSoft: palette.indigo[100],

  /* Carte */
  mapLand: palette.parchment[200],
  mapLandIdle: palette.parchment[400],
  mapStroke: palette.ink[300],
  mapStrokeStrong: palette.ink[700],
  mapWater: palette.sea[200],
  mapWaterDeep: palette.sea[500],
  mapGraticule: palette.parchment[600],
  mapRhumb: palette.parchment[600],
  mapTarget: palette.brass[300],
  mapCorrect: palette.verdigris[300],
  mapWrong: palette.vermilion[300],
};

/**
 * Rôles de couleur du thème.
 *
 * Type **mappé** sur les clés de la palette claire, avec des valeurs élargies à
 * `string`. Sans cet élargissement, chaque rôle hériterait du littéral
 * hexadécimal de `palette` (`canvas: '#F6EBD8'`) et la palette nuit — mêmes
 * clés, autres valeurs — deviendrait inassignable. Le contrôle qui compte,
 * l'identité exacte des clés entre les deux thèmes, reste assuré.
 */
export type Colors = { [K in keyof typeof lightColors]: string };

const darkColors: Colors = {
  canvas: palette.night[500],
  surface: palette.night[400],
  surfaceRaised: palette.night[300],
  surfaceSunk: palette.night[600],
  border: palette.night[200],
  borderStrong: palette.night[100],
  scrim: 'rgba(6, 10, 13, 0.65)',

  text: '#EFE2CB',
  textSecondary: '#B9A88C',
  textTertiary: '#7E7160',
  textInverse: palette.night[500],
  textOnAccent: palette.night[600],

  danger: '#E06248',
  dangerStrong: '#F07A60',
  dangerSoft: '#3A1F19',
  success: '#4FB39A',
  successStrong: '#6ECBB3',
  successSoft: '#123029',
  reward: '#E9BE55',
  rewardStrong: '#F5D580',
  rewardSoft: '#3A2E12',
  info: '#7FA6CE',
  infoSoft: '#1B2A3A',

  mapLand: palette.night[300],
  mapLandIdle: palette.night[400],
  mapStroke: '#4A5C68',
  mapStrokeStrong: '#9FB3BF',
  mapWater: palette.night[600],
  mapWaterDeep: '#0A0F13',
  mapGraticule: '#26333D',
  mapRhumb: '#26333D',
  mapTarget: '#E9BE55',
  mapCorrect: '#4FB39A',
  mapWrong: '#E06248',
};

export const colorSchemes: Record<ColorScheme, Colors> = {
  light: lightColors,
  dark: darkColors,
};

/** Échelle d'espacement 4pt. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

/** Rayons — papier découpé, jamais totalement rond sauf pastilles. */
export const radius = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 22,
  xl: 32,
  pill: 999,
} as const;

export const borderWidth = { hair: 1, thin: 1.5, thick: 2, heavy: 3 } as const;

/**
 * Ombres chaudes et basses : une feuille posée sur une autre feuille,
 * jamais une carte flottant dans le vide.
 */
export const elevation = {
  none: { shadowOpacity: 0, elevation: 0 },
  sheet: {
    shadowColor: '#241A12',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  lifted: {
    shadowColor: '#241A12',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  overlay: {
    shadowColor: '#241A12',
    shadowOpacity: 0.24,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
} as const;

/**
 * Mouvement. L'aiguille d'une boussole ne s'arrête pas net : elle oscille
 * puis se pose. Les springs priment sur les durées linéaires.
 */
export const motion = {
  duration: { instant: 90, fast: 160, base: 240, slow: 380, deliberate: 620 },
  spring: {
    /** Réponse d'interface courante — bouton, carte, panneau. */
    snappy: { damping: 18, stiffness: 260, mass: 0.9 },
    /** Aiguille de boussole : dépasse puis se stabilise. */
    needle: { damping: 11, stiffness: 140, mass: 1.1 },
    /** Objet lourd — feuille de carte, transition d'écran. */
    sheet: { damping: 24, stiffness: 160, mass: 1.2 },
    /** Rebond de récompense. */
    pop: { damping: 9, stiffness: 340, mass: 0.7 },
  },
} as const;

/** Cibles tactiles minimales (WCAG 2.2 AA : 24pt, on vise confortable). */
export const hitTarget = { min: 44, comfortable: 56 } as const;

export const opacity = { disabled: 0.38, muted: 0.62, ghost: 0.08 } as const;
