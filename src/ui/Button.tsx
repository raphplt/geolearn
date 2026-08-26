import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Occupe toute la largeur disponible. */
  block?: boolean;
  /** Élément posé avant le libellé — un emoji drapeau, un numéro de département. */
  leading?: React.ReactNode;
  detail?: string;
  style?: ViewStyle;
  accessibilityHint?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Bouton de l'application.
 *
 * L'enfoncement est animé par un ressort plutôt que par une transition de durée
 * fixe : un bouton qui se relâche linéairement se sent mécanique, là où un
 * ressort légèrement sous-amorti donne l'impression d'une matière qui reprend
 * sa forme. C'est la même intention que l'aiguille de boussole qui dépasse
 * avant de se poser.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  block = false,
  leading,
  detail,
  style,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: {
      bg: theme.colors.text,
      fg: theme.colors.textInverse,
      border: theme.colors.text,
    },
    secondary: {
      bg: theme.colors.surfaceRaised,
      fg: theme.colors.text,
      border: theme.colors.borderStrong,
    },
    ghost: { bg: 'transparent', fg: theme.colors.textSecondary, border: 'transparent' },
    danger: {
      bg: theme.colors.danger,
      fg: theme.colors.textOnAccent,
      border: theme.colors.dangerStrong,
    },
  };
  const colors = palette[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }, { translateY: pressed.value * 2 }],
  }));

  const handlePressIn = useCallback(() => {
    pressed.value = withSpring(1, theme.motion.spring.snappy);
  }, [pressed, theme.motion.spring.snappy]);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, theme.motion.spring.snappy);
  }, [pressed, theme.motion.spring.snappy]);

  const handlePress = useCallback(() => {
    tap();
    onPress?.();
  }, [onPress]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        animatedStyle,
        {
          minHeight: theme.hitTarget.comfortable,
          paddingHorizontal: theme.space.lg,
          paddingVertical: theme.space.md,
          borderRadius: theme.radius.md,
          backgroundColor: colors.bg,
          borderWidth: theme.borderWidth.thin,
          borderColor: colors.border,
          opacity: disabled ? theme.opacity.disabled : 1,
          alignSelf: block ? 'stretch' : 'flex-start',
          justifyContent: 'center',
        },
        variant !== 'ghost' ? theme.elevation.sheet : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {leading ? <View style={{ marginRight: theme.space.md }}>{leading}</View> : null}
        <View style={styles.labels}>
          <Text variant="label" color={colors.fg} numberOfLines={2}>
            {label}
          </Text>
          {detail ? (
            <Text variant="caption" color={colors.fg} style={{ opacity: 0.62 }} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  labels: { flex: 1 },
});
