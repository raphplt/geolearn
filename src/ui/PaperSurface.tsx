import { Image, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

const GRAIN_LIGHT = require('../../assets/paper-grain.png');
const GRAIN_DARK = require('../../assets/paper-grain-dark.png');

export type PaperSurfaceProps = ViewProps & {
  tone?: 'sunk' | 'base' | 'raised';
  grain?: number;
  radius?: keyof ReturnType<typeof useTheme>['radius'] | number;
  bordered?: boolean | 'soft' | 'base' | 'strong';
  elevation?: 'none' | 'sheet' | 'lifted' | 'overlay';
  bevel?: boolean;
};

export function PaperSurface({
  tone = 'base',
  grain = 0.5,
  radius = 'md',
  bordered = false,
  elevation = 'none',
  bevel,
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

  const borderColor =
    bordered === 'soft'
      ? theme.colors.borderSoft
      : bordered === 'strong'
        ? theme.colors.borderStrong
        : theme.colors.border;

  const showBevel = bevel ?? elevation !== 'none';

  const surfaceStyle: ViewStyle = {
    backgroundColor: background,
    borderRadius,
    ...(bordered
      ? { borderWidth: theme.borderWidth.hair, borderColor }
      : null),
    ...(elevation !== 'none' ? theme.elevation[elevation] : null),
  };

  return (
    <View {...rest} style={[surfaceStyle, style]}>
      {grain > 0 ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={theme.scheme === 'dark' ? GRAIN_DARK : GRAIN_LIGHT}
            resizeMode="repeat"
            style={[StyleSheet.absoluteFill, { borderRadius, opacity: grain }]}
          />
        </View>
      ) : null}

      {showBevel ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: borderRadius * 0.5,
            right: borderRadius * 0.5,
            top: 0,
            height: 1,
            backgroundColor: theme.colors.bevel,
            opacity: theme.scheme === 'dark' ? 1 : 0.7,
          }}
        />
      ) : null}

      {children}
    </View>
  );
}
