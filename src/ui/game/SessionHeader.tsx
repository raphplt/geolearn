import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { comboMultiplier, questionTotal, RULES } from '@/game/session';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { IconBack, IconHull } from '@/ui/icons';
import { useReducedMotion } from '@/ui/motion';
import { Text } from '@/ui/Text';

/**
 * The counter, the score and the hourglass all describe the question on screen.
 * None of them moves while a verdict is being read, nor while the player is
 * somewhere else entirely.
 */
export function SessionHeader({ onQuit }: { onQuit: () => void }) {
  const theme = useTheme();
  const session = useSession((s) => s.session);
  const expireSession = useSession((s) => s.expire);

  const progress = useSharedValue(1);
  const expiresAt = session?.expiresAt ?? null;
  const paused = session?.pausedAt ?? null;
  const suspended = session?.suspendedAt ?? null;

  useEffect(() => {
    if (expiresAt === null) return;

    const stopped = paused ?? suspended;
    if (stopped !== null) {
      cancelAnimation(progress);
      progress.value = Math.min(1, Math.max(0, (expiresAt - stopped) / RULES.timeCap));
      return;
    }

    const remaining = Math.max(0, expiresAt - Date.now());
    progress.value = Math.min(1, remaining / RULES.timeCap);
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear });

    const timer = setTimeout(() => expireSession(), remaining);
    return () => clearTimeout(timer);
  }, [expiresAt, paused, suspended, progress, expireSession]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, progress.value) * 100}%`,
  }));

  if (!session) return null;

  const multiplier = comboMultiplier(session.combo);
  const total = questionTotal(session);

  return (
    <View style={{ paddingHorizontal: theme.space.sm, paddingRight: theme.space.lg }}>
      <View style={styles.row}>
        <Pressable
          onPress={onQuit}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Quitter la partie"
          style={styles.back}
        >
          <IconBack size={24} color={theme.colors.textSecondary} />
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text variant="numeral" tabular>
            {session.score}
          </Text>
          {total ? (
            <Text variant="caption" color="textTertiary" tabular>
              {Math.min(session.index + 1, total)} / {total}
            </Text>
          ) : null}
        </View>

        <ComboBadge combo={session.combo} multiplier={multiplier} />
      </View>

      {session.config.lives !== undefined ? (
        <View
          style={{
            flexDirection: 'row',
            gap: 4,
            marginTop: theme.space.xs,
            marginLeft: theme.space.sm,
          }}
          accessibilityLabel={`${session.config.lives - session.wrecks} coques intactes`}
        >
          {Array.from({ length: session.config.lives }, (_, i) => (
            <IconHull
              key={i}
              size={15}
              active={i >= session.wrecks}
              color={i >= session.wrecks ? theme.colors.textSecondary : theme.colors.dangerSoft}
            />
          ))}
        </View>
      ) : null}

      {expiresAt !== null ? (
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.surfaceSunk,
            overflow: 'hidden',
            marginTop: theme.space.sm,
            marginHorizontal: theme.space.sm,
          }}
        >
          <Animated.View
            style={[{ height: '100%', backgroundColor: theme.colors.danger }, barStyle]}
          />
        </View>
      ) : null}
    </View>
  );
}

function ComboBadge({ combo, multiplier }: { combo: number; multiplier: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (combo === 0 || reduced) return;
    scale.value = withSpring(1.18, theme.motion.spring.pop, () => {
      scale.value = withSpring(1, theme.motion.spring.pop);
    });
  }, [combo, scale, reduced, theme.motion.spring.pop]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ minWidth: 62, alignItems: 'flex-end' }, style]}>
      {combo > 0 ? (
        <Text variant="numeral" color={multiplier > 1 ? 'reward' : 'textSecondary'} tabular>
          ×{multiplier}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
