import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { tap } from '@/fx/haptics';
import { useTheme, type Theme } from '@/theme';
import { Text } from './Text';

export type ButtonVariant = 'action' | 'secondary' | 'ghost';

export type ButtonTone = 'danger' | 'reward' | 'success' | 'ink';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  disabled?: boolean;
  block?: boolean;
  leading?: React.ReactNode;
  detail?: string;
  size?: 'md' | 'lg';
  style?: ViewStyle;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'action',
  tone = 'danger',
  disabled = false,
  block = false,
  leading,
  detail,
  size = 'md',
  style,
  accessibilityHint,
}: ButtonProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const skin = skinOf(theme, variant, tone);
  const height = size === 'lg' ? 62 : theme.hitTarget.comfortable;

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * skin.depth }],
  }));

  const handlePressIn = useCallback(() => {
    pressed.value = withSpring(1, { damping: 24, stiffness: 480, mass: 0.6 });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, theme.motion.spring.pop);
  }, [pressed, theme.motion.spring.pop]);

  const handlePress = useCallback(() => {
    tap();
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        {
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: disabled ? theme.opacity.disabled : 1,
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: skin.side,
          borderRadius: theme.radius.md,
          paddingBottom: skin.depth,
        }}
      >
        <Animated.View style={faceStyle}>
          <View
            style={{
              minHeight: height,
              borderRadius: theme.radius.md,
              backgroundColor: skin.face,
              borderWidth: skin.borderWidth,
              borderColor: skin.border,
              paddingHorizontal: theme.space.lg,
              paddingVertical: theme.space.md,
              justifyContent: 'center',
              overflow: 'hidden',
            }}
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

            <View style={styles.row}>
              {leading ? <View style={{ marginRight: theme.space.md }}>{leading}</View> : null}
              <View style={styles.labels}>
                <Text
                  variant={size === 'lg' ? 'titleLg' : 'label'}
                  color={skin.label}
                  align={leading ? 'left' : 'center'}
                  numberOfLines={2}
                >
                  {label}
                </Text>
                {detail ? (
                  <Text
                    variant="caption"
                    color={skin.label}
                    align={leading ? 'left' : 'center'}
                    style={{ opacity: 0.72 }}
                    numberOfLines={1}
                  >
                    {detail}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

type Skin = {
  face: string;
  side: string;
  border: string;
  borderWidth: number;
  label: string;
  depth: number;
  sheen: boolean;
};

function skinOf(theme: Theme, variant: ButtonVariant, tone: ButtonTone): Skin {
  if (variant === 'ghost') {
    return {
      face: 'transparent',
      side: 'transparent',
      border: 'transparent',
      borderWidth: 0,
      label: theme.colors.textSecondary,
      depth: 0,
      sheen: false,
    };
  }

  if (variant === 'secondary') {
    return {
      face: theme.colors.surfaceRaised,
      side: theme.colors.borderStrong,
      border: theme.colors.borderStrong,
      borderWidth: theme.borderWidth.thin,
      label: theme.colors.text,
      depth: 2,
      sheen: false,
    };
  }

  const accents: Record<ButtonTone, { face: string; side: string; label: string }> = {
    danger: {
      face: theme.colors.danger,
      side: theme.colors.dangerDeep,
      label: theme.colors.textOnAccent,
    },
    reward: {
      face: theme.colors.reward,
      side: theme.colors.rewardDeep,
      label: theme.colors.textOnAccent,
    },
    success: {
      face: theme.colors.success,
      side: theme.colors.successDeep,
      label: theme.colors.textOnAccent,
    },
    ink: {
      face: theme.colors.text,
      side: theme.colors.text,
      label: theme.colors.textInverse,
    },
  };

  const accent = accents[tone];
  return {
    ...accent,
    border: 'transparent',
    borderWidth: 0,
    depth: tone === 'ink' ? 0 : 5,
    sheen: tone !== 'ink',
  };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  labels: { flex: 1 },
});
