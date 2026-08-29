import { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';

/**
 * The physical model shared by everything the player presses: a coloured side
 * showing under a face, and a face that sinks into it. It is the whole reason a
 * Portulan button reads as an object rather than as a coloured rectangle, so
 * answers use it too — they are the most-pressed surface in the application.
 */
export type PlateSkin = {
  face: string;
  side: string;
  border: string;
  borderWidth: number;
  label: string;
  depth: number;
  sheen: boolean;
};

export type PressPlateProps = {
  skin: PlateSkin;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  block?: boolean;
  minHeight?: number;
  radius?: number;
  /** Haptics are reserved for outcomes; a plate that answers stays silent. */
  haptic?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  children: React.ReactNode;
};

export function PressPlate({
  skin,
  onPress,
  onLongPress,
  disabled = false,
  block = false,
  minHeight,
  radius,
  haptic = true,
  style,
  contentStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  children,
}: PressPlateProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const borderRadius = radius ?? theme.radius.md;

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * skin.depth }],
  }));

  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, { damping: 24, stiffness: 480, mass: 0.6 });
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, theme.motion.spring.pop);
  }, [pressed, theme.motion.spring.pop]);

  const handlePress = useCallback(() => {
    if (haptic) tap();
    onPress?.();
  }, [haptic, onPress]);

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      disabled={disabled}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={[{ alignSelf: block ? 'stretch' : 'flex-start' }, style]}
    >
      <View
        style={{
          backgroundColor: skin.side,
          borderRadius,
          paddingBottom: skin.depth,
        }}
      >
        <Animated.View style={faceStyle}>
          <View
            style={[
              {
                minHeight,
                borderRadius,
                backgroundColor: skin.face,
                borderWidth: skin.borderWidth,
                borderColor: skin.border,
                justifyContent: 'center',
                overflow: 'hidden',
              },
              contentStyle,
            ]}
          >
            {skin.sheen ? (
              <LinearGradient
                colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            ) : null}

            {children}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}
