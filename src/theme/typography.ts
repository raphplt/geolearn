import type { TextStyle } from 'react-native';

/**
 * Trio typographique de Portulan.
 *
 *  Fraunces   — display. Serif variable au ductus « wonky », chaleureux et gravé.
 *               Porte l'identité : titres, cartouches, chiffres héroïques.
 *  Spectral   — texte. Serif dessiné pour l'écran : garde le grain du papier
 *               tout en restant lisible à 13pt sur un téléphone.
 *  Space Mono — instruments. Chronomètres, scores, codes de départements.
 *               Le cadran mécanique du sextant.
 */
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

/**
 * Rôles typographiques. On style par rôle, jamais par taille brute :
 * `<Text role="cartouche">` et non `fontSize: 13`.
 */
export const textRoles = {
  /** Écran de fin de partie, chiffre unique qui occupe l'écran. */
  displayXL: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  /** Titre d'écran. */
  display: {
    fontFamily: fontFamily.displayBlack,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  /** Titre de carte ou de section importante. */
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
  /**
   * Le libellé gravé des cartes anciennes : capitales espacées.
   * Réservé aux en-têtes de section et aux étiquettes de statistiques.
   */
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
  /** L'annotation en italique portée par les mers sur les cartes marines. */
  note: {
    fontFamily: fontFamily.bodyItalic,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  /** Texte des boutons et des champs. */
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

  /* Instruments — toujours tabulaires, jamais de saut de largeur au décompte. */
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
