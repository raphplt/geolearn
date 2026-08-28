import type { TextStyle } from 'react-native';

export const fontFamily = {
  displayBlack: 'Fraunces_900Black',
  displayBold: 'Fraunces_700Bold',
  displaySemi: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_700Bold_Italic',
  body: 'Spectral_400Regular',
  bodyMedium: 'Spectral_500Medium',
  bodySemi: 'Spectral_600SemiBold',
  bodyItalic: 'Spectral_400Regular_Italic',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
} as const;

export type FontFamily = keyof typeof fontFamily;

export const textRoles = {
  displayXL: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  display: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  titleLg: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  title: {
    fontFamily: fontFamily.displaySemi,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.1,
  },
  cartouche: {
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.bodySemi, fontSize: 16, lineHeight: 24 },
  bodySm: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21 },
  note: {
    fontFamily: fontFamily.bodyItalic,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  label: {
    fontFamily: fontFamily.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelSm: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  caption: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },

  numeralXL: {
    fontFamily: fontFamily.monoBold,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1.5,
  },
  numeral: {
    fontFamily: fontFamily.monoBold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  numeralSm: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.4,
  },
} as const satisfies Record<string, TextStyle>;

export type TextRole = keyof typeof textRoles;
