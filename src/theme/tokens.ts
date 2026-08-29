export const palette = {
  parchment: {
    50: '#FFFCF5',
    100: '#FBF5E8',
    200: '#F5EBD9',
    300: '#EDE0C6',
    400: '#DECDAA',
    500: '#C9B48C',
    600: '#B29A6E',
  },
  ink: {
    900: '#1E1610',
    800: '#2C2117',
    700: '#41321F',
    600: '#563F2A',
    500: '#6B5238',
    400: '#7B5F43',
    300: '#977B5B',
    200: '#AA9374',
    100: '#CDBA9B',
  },
  vermilion: {
    100: '#F7DDD4',
    200: '#EDB6A5',
    300: '#D9775B',
    500: '#B93C24',
    600: '#992C17',
    700: '#731D10',
  },
  verdigris: {
    100: '#D3E5E0',
    200: '#A7CCC2',
    300: '#529886',
    500: '#237362',
    600: '#175748',
    700: '#0E3D32',
  },
  brass: {
    100: '#F7E8C4',
    200: '#EBD096',
    300: '#D9AE51',
    500: '#966D10',
    600: '#8A630C',
    700: '#654809',
  },
  sea: {
    100: '#DEEDEA',
    200: '#C6DCD8',
    300: '#98B5B0',
    400: '#84ADA8',
    500: '#628E89',
    600: '#47706C',
    700: '#33534F',
  },
  indigo: {
    100: '#DBE3ED',
    300: '#7E9BBB',
    500: '#345678',
    700: '#203952',
  },
  night: {
    50: '#5A6B7E',
    100: '#44525F',
    200: '#333F4B',
    300: '#26313B',
    400: '#1C242C',
    500: '#141A20',
    600: '#0D1216',
    700: '#080B0E',
  },
} as const;

export type ColorScheme = 'light' | 'dark';

const lightColors = {
  canvas: palette.parchment[300],
  surface: palette.parchment[200],
  surfaceRaised: palette.parchment[50],
  surfaceSunk: palette.parchment[400],

  borderSoft: palette.parchment[500],
  border: palette.ink[200],
  borderStrong: palette.ink[400],

  bevel: '#FFFFFF',
  scrim: 'rgba(30, 22, 16, 0.62)',

  text: palette.ink[900],
  textSecondary: palette.ink[500],
  textTertiary: palette.ink[400],
  textQuiet: palette.ink[200],
  textInverse: palette.parchment[50],
  textOnAccent: palette.parchment[50],

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

  dangerDeep: palette.vermilion[700],
  successDeep: palette.verdigris[700],
  rewardDeep: palette.brass[700],

  mapWater: palette.sea[300],
  mapWaterDeep: palette.sea[600],
  mapLandIdle: palette.parchment[200],
  mapLand: palette.verdigris[300],
  mapStroke: palette.ink[300],
  mapStrokeStrong: palette.ink[800],
  mapGraticule: palette.sea[400],
  mapRhumb: palette.parchment[500],
  mapTarget: palette.brass[300],
  mapCorrect: palette.verdigris[300],
  mapWrong: palette.vermilion[300],
  mapLabel: palette.ink[800],
  mapLabelHalo: palette.parchment[50],
};

export type Colors = { [K in keyof typeof lightColors]: string };

const darkColors: Colors = {
  canvas: palette.night[500],
  surface: palette.night[400],
  surfaceRaised: palette.night[300],
  surfaceSunk: palette.night[700],

  borderSoft: palette.night[200],
  border: palette.night[100],
  borderStrong: palette.night[50],

  bevel: 'rgba(150, 178, 200, 0.16)',
  scrim: 'rgba(4, 7, 9, 0.72)',

  text: '#F2E7D3',
  textSecondary: '#C4B399',
  textTertiary: '#A6957D',
  textQuiet: '#6E6252',
  textInverse: palette.night[600],
  textOnAccent: '#0B0F13',

  danger: '#F0765A',
  dangerStrong: '#FF9077',
  dangerSoft: '#3E1F17',
  success: '#4FBBA0',
  successStrong: '#74D6BC',
  successSoft: '#0F332B',
  reward: '#EDC15A',
  rewardStrong: '#FBDA8C',
  rewardSoft: '#3B2E11',
  info: '#8FB2D8',
  infoSoft: '#1A2B3C',

  dangerDeep: '#8E3623',
  successDeep: '#1F6E5C',
  rewardDeep: '#8A6A1E',

  mapWater: '#05090C',
  mapWaterDeep: '#020406',
  mapLandIdle: palette.night[200],
  mapLand: '#328672',
  mapStroke: '#5D7385',
  mapStrokeStrong: '#A8C0D0',
  mapGraticule: '#1E3038',
  mapRhumb: '#243440',
  mapTarget: '#EDC15A',
  mapCorrect: '#4FBBA0',
  mapWrong: '#F0765A',
  mapLabel: '#EDE2CE',
  mapLabelHalo: '#0B1116',
};

export const colorSchemes: Record<ColorScheme, Colors> = {
  light: lightColors,
  dark: darkColors,
};

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

export const radius = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 22,
  xl: 32,
  pill: 999,
} as const;

export const borderWidth = { hair: 1, thin: 1.5, thick: 2, heavy: 3 } as const;

export const elevation = {
  none: { shadowOpacity: 0, elevation: 0 },
  sheet: {
    shadowColor: '#1E1610',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  lifted: {
    shadowColor: '#1E1610',
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  overlay: {
    shadowColor: '#1E1610',
    shadowOpacity: 0.38,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
} as const;

/**
 * One structural animation per navigation, and nothing decorative on top.
 * `base` and `emphasis` cover everything ordinary; `ceremony` is reserved for
 * the four moments that deserve it — a promotion, a brevet, a sealed cartouche,
 * a rank. `instant` is the press response, and must never be scheduled behind
 * another animation.
 */
export const motion = {
  duration: { instant: 90, fast: 140, base: 180, emphasis: 240, ceremony: 360 },
  spring: {
    snappy: { damping: 20, stiffness: 340, mass: 0.7 },
    needle: { damping: 13, stiffness: 180, mass: 1 },
    sheet: { damping: 26, stiffness: 220, mass: 0.9 },
    pop: { damping: 12, stiffness: 420, mass: 0.6 },
  },
  /** Perceptual budgets, in milliseconds. Exit criteria of the audit. */
  budget: {
    touchResponse: 100,
    perceptiblePause: 150,
    loaderThreshold: 150,
  },
  /** How long a verdict stays on screen before the next question slides in. */
  feedback: { correct: 420, wrong: 1_300 },
} as const;

export const hitTarget = { min: 44, comfortable: 56 } as const;

export const opacity = { disabled: 0.38, muted: 0.62, ghost: 0.08 } as const;
