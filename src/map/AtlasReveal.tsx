import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { Atlas, Territory } from '@/data/types';
import { useTheme } from '@/theme';
import { useReducedMotion } from '@/ui/motion';

const WAVES = 12;

const WAVE_MS = 460;

const WAVE_STEP = 130;

/**
 * The atlas learning itself, wave after wave, from the territories everyone
 * knows to the ones nobody does.
 *
 * The point is that nothing is computed while it plays. The waves are cut once
 * at mount, each becomes its own layer, and the only thing that moves is an
 * opacity per layer — on the UI thread, indifferent to what JavaScript is
 * doing. The previous version rebuilt a hundred paths every 70 ms on the
 * JavaScript thread, which is exactly the kind of cost a player reads as
 * heaviness on the very first screen they see.
 */
export const AtlasReveal = memo(function AtlasReveal({
  atlas,
  order,
  style,
}: {
  atlas: Atlas<Territory>;
  /** Territory ids, easiest first. Anything missing joins the last wave. */
  order?: readonly string[];
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  const waves = useMemo(() => cut(atlas, order), [atlas, order]);

  return (
    <View style={[{ flex: 1 }, style]} pointerEvents="none">
      <Layer
        territories={atlas.territories}
        fill={theme.colors.mapLandIdle}
        stroke={theme.colors.mapStroke}
        atlas={atlas}
      />

      {waves.map((wave, i) => (
        <Wave key={i} delay={i * WAVE_STEP} reduced={reduced}>
          <Layer
            territories={wave}
            fill={theme.colors.mapLand}
            stroke={theme.colors.mapStroke}
            atlas={atlas}
          />
        </Wave>
      ))}
    </View>
  );
});

/** Splits the atlas into contiguous slices of the difficulty order. */
function cut(atlas: Atlas<Territory>, order?: readonly string[]): Territory[][] {
  const drawable = atlas.territories.filter((t) => t.d !== '');

  const ranked = order
    ? [...drawable].sort((a, b) => rank(order, a.id) - rank(order, b.id))
    : drawable;

  const size = Math.ceil(ranked.length / WAVES);
  const waves: Territory[][] = [];
  for (let i = 0; i < ranked.length; i += size) waves.push(ranked.slice(i, i + size));
  return waves;
}

function rank(order: readonly string[], id: string): number {
  const at = order.indexOf(id);
  return at === -1 ? Number.MAX_SAFE_INTEGER : at;
}

function Wave({
  delay,
  reduced,
  children,
}: {
  delay: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: WAVE_MS, easing: Easing.out(Easing.quad) }),
    );
  }, [opacity, delay, reduced]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

const Layer = memo(function Layer({
  atlas,
  territories,
  fill,
  stroke,
}: {
  atlas: Atlas<Territory>;
  territories: readonly Territory[];
  fill: string;
  stroke: string;
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${atlas.width} ${atlas.height}`}
      preserveAspectRatio="xMidYMid meet"
      style={StyleSheet.absoluteFill}
    >
      {territories.map((t) =>
        t.d ? <Path key={t.id} d={t.d} fill={fill} stroke={stroke} strokeWidth={6} /> : null,
      )}
    </Svg>
  );
});
