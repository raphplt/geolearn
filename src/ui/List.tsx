import { Pressable, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';
import { IconChevron } from './icons';
import { Text } from './Text';
import { Toggle } from './Toggle';
import { usePressResponse } from './motion';

/**
 * Mobile list grammar: a quiet section label, full-bleed rows, hairlines inset
 * to the text. Frames and cards are reserved for things that are genuinely
 * objects — a reward, a territory, a result.
 */
export function ListSection({
  title,
  footer,
  style,
  children,
}: {
  title?: string;
  footer?: string;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={style}>
      {title ? (
        <Text
          variant="cartouche"
          color="textTertiary"
          style={{
            paddingHorizontal: theme.space.lg,
            marginBottom: theme.space.xs,
          }}
        >
          {title}
        </Text>
      ) : null}

      <View>{children}</View>

      {footer ? (
        <Text
          variant="caption"
          color="textTertiary"
          style={{ paddingHorizontal: theme.space.lg, marginTop: theme.space.sm }}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export type ListRowProps = {
  title: string;
  detail?: string;
  meta?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger' | 'info';
  disabled?: boolean;
  selected?: boolean;
  chevron?: boolean;
  first?: boolean;
  accessibilityRole?: 'button' | 'radio' | 'link';
};

export function ListRow({
  title,
  detail,
  meta,
  leading,
  trailing,
  onPress,
  tone = 'default',
  disabled = false,
  selected = false,
  chevron = false,
  first = false,
  accessibilityRole = 'button',
}: ListRowProps) {
  const theme = useTheme();
  const press = usePressResponse(0.012);

  const titleColor =
    tone === 'danger' ? 'danger' : tone === 'info' ? 'info' : selected ? 'text' : 'text';

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        minHeight: theme.hitTarget.comfortable,
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.sm,
        backgroundColor: selected ? theme.colors.surfaceRaised : 'transparent',
        borderRadius: selected ? theme.radius.md : 0,
        opacity: disabled ? theme.opacity.disabled : 1,
      }}
    >
      {leading}

      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="label" color={titleColor} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>

      {meta ? (
        <Text variant="numeralSm" color="textSecondary" tabular>
          {meta}
        </Text>
      ) : null}

      {trailing}

      {chevron ? <IconChevron size={18} color={theme.colors.textTertiary} /> : null}
    </View>
  );

  return (
    <View>
      {first ? null : (
        <View
          style={{
            height: theme.borderWidth.hair,
            marginLeft: theme.space.lg,
            backgroundColor: theme.colors.border,
            opacity: selected ? 0 : 0.5,
          }}
        />
      )}

      {onPress ? (
        <Animated.View style={press.style}>
          <Pressable
            onPress={() => {
              tap();
              onPress();
            }}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            disabled={disabled}
            accessibilityRole={accessibilityRole}
            accessibilityState={{ disabled, selected }}
            accessibilityLabel={detail ? `${title}. ${detail}` : title}
          >
            {body}
          </Pressable>
        </Animated.View>
      ) : (
        body
      )}
    </View>
  );
}

export function ListSwitch({
  title,
  detail,
  value,
  onChange,
  first = false,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  first?: boolean;
}) {
  return (
    <ListRow
      title={title}
      detail={detail}
      first={first}
      trailing={<Toggle value={value} onChange={onChange} label={title} />}
    />
  );
}
