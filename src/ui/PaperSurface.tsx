import { Image, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

const GRAIN_LIGHT = require('../../assets/paper-grain.png');
const GRAIN_DARK = require('../../assets/paper-grain-dark.png');

export type PaperSurfaceProps = ViewProps & {
  /** Niveau de la feuille : creusée, à plat, ou posée par-dessus. */
  tone?: 'sunk' | 'base' | 'raised';
  /** Intensité du grain, de 0 à 1. Le fond général en veut plus qu'une carte posée dessus. */
  grain?: number;
  radius?: keyof ReturnType<typeof useTheme>['radius'] | number;
  bordered?: boolean;
  elevation?: 'none' | 'sheet' | 'lifted' | 'overlay';
};

/**
 * Surface de papier — le matériau de base de toute l'application.
 *
 * Le grain est une image répétée superposée à l'aplat, et non un filtre SVG :
 * react-native-svg expose bien `feTurbulence` côté JavaScript, mais sans
 * implémentation native, si bien que le filtre ne rend rien sur l'appareil.
 *
 * La texture encode son intensité dans le **canal alpha** d'un aplat d'encre.
 * React Native n'offre pas de mode de fusion « multiply » portable ; en peignant
 * de l'encre translucide là où le grain est dense, on obtient exactement l'effet
 * recherché — la surface se patine sans jamais s'éclaircir — avec le seul
 * alpha-blending, disponible partout.
 */
export function PaperSurface({
  tone = 'base',
  grain = 0.5,
  radius = 'md',
  bordered = false,
  elevation = 'none',
  style,
  children,
  ...rest
}: PaperSurfaceProps) {
  const theme = useTheme();

  const background =
    tone === 'sunk'
      ? theme.colors.surfaceSunk
      : tone === 'raised'
        ? theme.colors.surfaceRaised
        : theme.colors.surface;

  const borderRadius = typeof radius === 'number' ? radius : theme.radius[radius];

  const surfaceStyle: ViewStyle = {
    backgroundColor: background,
    borderRadius,
    ...(bordered
      ? { borderWidth: theme.borderWidth.hair, borderColor: theme.colors.border }
      : null),
    ...(elevation !== 'none' ? theme.elevation[elevation] : null),
  };

  return (
    <View {...rest} style={[surfaceStyle, style]}>
      {grain > 0 ? (
        /* Le voile est enveloppé dans une vue non tangible : `pointerEvents`
           n'existe pas sur le style d'une Image, et sans cette précaution la
           texture intercepterait les touchers destinés au contenu. */
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={theme.scheme === 'dark' ? GRAIN_DARK : GRAIN_LIGHT}
            resizeMode="repeat"
            style={[StyleSheet.absoluteFill, { borderRadius, opacity: grain }]}
          />
        </View>
      ) : null}
      {children}
    </View>
  );
}
