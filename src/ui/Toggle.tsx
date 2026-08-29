import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';

import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';

export function Toggle({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const theme = useTheme();

  const TRACK = 52;
  const KNOB = 24;
  const PAD = 3;

  const progress = useDerivedValue(() => withSpring(value ? 1 : 0, theme.motion.spring.snappy));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (TRACK - KNOB - PAD * 2) }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        tap();
        onChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={10}
      style={{
        width: TRACK,
        height: KNOB + PAD * 2,
        borderRadius: theme.radius.pill,
        padding: PAD,
        justifyContent: 'center',
        backgroundColor: value ? theme.colors.rewardSoft : theme.colors.surfaceSunk,
        borderWidth: theme.borderWidth.hair,
        borderColor: value ? theme.colors.reward : theme.colors.border,
        opacity: disabled ? theme.opacity.disabled : 1,
      }}
    >
      <Animated.View style={knobStyle}>
        <View
          style={{
            width: KNOB,
            height: KNOB,
            borderRadius: theme.radius.pill,
            backgroundColor: value ? theme.colors.reward : theme.colors.surfaceRaised,
            borderWidth: theme.borderWidth.hair,
            borderColor: value ? theme.colors.rewardStrong : theme.colors.border,
            ...theme.elevation.sheet,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
