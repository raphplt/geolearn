import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import type { Atlas, Territory } from '@/data/types';
import { useTheme } from '@/theme';

export const AtlasSilhouette = memo(function AtlasSilhouette({
  atlas,
  width,
  height,
  opacity = 0.1,
  color,
}: {
  atlas: Atlas<Territory>;
  width?: number;
  height?: number;
  opacity?: number;
  color?: string;
}) {
  const theme = useTheme();
  if (!atlas.outline) return null;

  return (
    <Svg
      width={width ?? '100%'}
      height={height ?? '100%'}
      viewBox={`0 0 ${atlas.width} ${atlas.height}`}
      preserveAspectRatio="xMidYMid meet"
      opacity={opacity}
      pointerEvents="none"
    >
      <Path
        d={atlas.outline}
        fill={color ?? theme.colors.text}
        stroke={color ?? theme.colors.text}
        strokeWidth={6}
        strokeLinejoin="round"
      />
    </Svg>
  );
});
