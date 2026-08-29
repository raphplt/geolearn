import { useCallback, useMemo } from 'react';
import {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import { motion } from '@/theme/tokens';

export { useReducedMotion };

/**
 * Immediate press response, driven on the UI thread and therefore independent
 * of whatever the JavaScript thread is doing. Every tappable surface uses this
 * so a touch always produces a visible reaction well inside the 100 ms budget.
 */
export function usePressResponse(depth = 0.03) {
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * depth }],
  }));

  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, motion.spring.snappy);
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, motion.spring.snappy);
  }, [pressed]);

  return { style, onPressIn, onPressOut, pressed };
}

/**
 * The single structural entrance an immersive screen is allowed. Returns
 * `undefined` — meaning "appear, do not animate" — whenever the system asks for
 * reduced motion, and on every screen that is merely being returned to.
 */
export function useEntrance(enabled = true): EntryExitAnimationFunction | undefined {
  const reduced = useReducedMotion();
  return useMemo(
    () =>
      reduced || !enabled
        ? undefined
        : (FadeIn.duration(motion.duration.base) as unknown as EntryExitAnimationFunction),
    [reduced, enabled],
  );
}

/** A ceremonial scale-in that flattens to nothing under reduced motion. */
export function useEmphasis(from = 0.86) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : from);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const play = useCallback(() => {
    scale.value = reduced ? 1 : withSpring(1, motion.spring.needle);
  }, [scale, reduced]);

  return { style, play, reduced };
}
