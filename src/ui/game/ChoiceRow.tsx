import { View } from 'react-native';

import { useTheme, type Theme } from '@/theme';
import { Flag } from '@/ui/Flag';
import { PressPlate, type PlateSkin } from '@/ui/Plate';
import { Text } from '@/ui/Text';

export type ChoiceState = 'idle' | 'correct' | 'wrong' | 'dimmed';

/**
 * An answer is the most-pressed surface of the application, so it is built on
 * the same physical model as the main actions: a side showing under the face,
 * a sheen on the top edge, and a face that sinks when touched. The verdict
 * repaints the plate rather than adding a decoration to it.
 */
export function ChoiceRow({
  label,
  flagCode,
  state,
  onPress,
  disabled,
}: {
  label: string;
  flagCode?: string;
  state: ChoiceState;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const skin = choiceSkin(theme, state);

  return (
    <PressPlate
      skin={skin}
      onPress={onPress}
      disabled={disabled}
      block
      haptic={false}
      minHeight={theme.hitTarget.comfortable}
      accessibilityLabel={label}
      style={{ opacity: state === 'dimmed' ? theme.opacity.disabled : 1 }}
      contentStyle={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
        {flagCode ? <Flag cca2={flagCode} height={22} radius={theme.radius.xs} /> : null}
        <Text variant="label" color={skin.label} style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressPlate>
  );
}

function choiceSkin(theme: Theme, state: ChoiceState): PlateSkin {
  const base = { borderWidth: theme.borderWidth.hair, depth: 4, sheen: true };

  if (state === 'correct') {
    return {
      ...base,
      face: theme.colors.successSoft,
      side: theme.colors.success,
      border: theme.colors.success,
      label: theme.colors.text,
    };
  }

  if (state === 'wrong') {
    return {
      ...base,
      face: theme.colors.dangerSoft,
      side: theme.colors.danger,
      border: theme.colors.danger,
      label: theme.colors.text,
    };
  }

  return {
    ...base,
    face: theme.colors.surfaceRaised,
    side: theme.colors.surfaceSunk,
    border: theme.colors.border,
    label: theme.colors.text,
  };
}
