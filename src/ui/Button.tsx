import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '@/theme';
import { PressPlate, type PlateSkin } from './Plate';
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

  const skin = skinOf(theme, variant, tone);
  const height = size === 'lg' ? 62 : theme.hitTarget.comfortable;

  return (
    <PressPlate
      skin={skin}
      onPress={onPress}
      disabled={disabled}
      block={block}
      minHeight={height}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={{ opacity: disabled ? theme.opacity.disabled : 1, ...style }}
      contentStyle={{
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
      }}
    >
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
    </PressPlate>
  );
}

function skinOf(theme: Theme, variant: ButtonVariant, tone: ButtonTone): PlateSkin {
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
