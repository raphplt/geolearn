import { Pressable, View, type ViewStyle } from 'react-native';

import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';
import { Text } from './Text';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * The mobile answer to a pair of giant radio tiles: one compact control, read
 * in a glance, tappable with the thumb.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
  compact = false,
  accessibilityLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  style?: ViewStyle;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: 'row',
          padding: 3,
          gap: 3,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceSunk,
          borderWidth: theme.borderWidth.hair,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (selected) return;
              tap();
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: compact ? 32 : theme.hitTarget.min - 6,
              paddingHorizontal: theme.space.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.pill,
              backgroundColor: selected ? theme.colors.surfaceRaised : 'transparent',
            }}
          >
            <Text
              variant={compact ? 'labelSm' : 'label'}
              color={selected ? 'text' : 'textTertiary'}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
