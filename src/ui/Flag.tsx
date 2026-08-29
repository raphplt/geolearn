import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { flagOf } from '@/data/flags';
import { useTheme } from '@/theme';

export type FlagProps = {
  cca2: string | undefined;
  width?: number;
  height?: number;
  label?: string;
  radius?: number;
  framed?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Flag({ cca2, width, height, label, radius, framed = true, style }: FlagProps) {
  const theme = useTheme();
  const asset = flagOf(cca2);

  if (!asset) return null;

  const ratio = asset.width / asset.height;
  const boxWidth = width ?? (height ?? 0) * ratio;
  const boxHeight = height ?? (width ?? 0) / ratio;
  if (boxWidth <= 0 || boxHeight <= 0) return null;

  const scale = Math.min(boxWidth / asset.width, boxHeight / asset.height);
  const finalWidth = asset.width * scale;
  const finalHeight = asset.height * scale;

  const borderRadius = radius ?? Math.min(theme.radius.sm, finalHeight * 0.12);

  return (
    <View
      style={[
        {
          width: finalWidth,
          height: finalHeight,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceSunk,
          ...(framed
            ? {
                borderWidth: theme.borderWidth.hair,
                borderColor: theme.colors.border,
                ...theme.elevation.sheet,
              }
            : null),
        },
        style,
      ]}
      accessible={Boolean(label)}
      accessibilityRole="image"
      accessibilityLabel={label ? `Drapeau — ${label}` : undefined}
    >
      <Image
        source={asset.source}
        contentFit="fill"
        style={{ width: '100%', height: '100%' }}
        transition={90}
        cachePolicy="memory-disk"
      />
    </View>
  );
}
