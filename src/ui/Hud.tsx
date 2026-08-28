import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import type { IconProps } from '@/ui/icons';

export type HudChip = {
  key: string;
  value: string;
  tone: 'reward' | 'success' | 'danger' | 'text';
  icon: (props: IconProps) => React.ReactElement;
};

export function Hud({
  chips,
  rank,
  trailing,
}: {
  chips: HudChip[];
  rank?: { name: string; ratio: number };
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + theme.space.sm,
        paddingBottom: theme.space.sm,
        paddingHorizontal: theme.space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
      }}
    >
      {chips.map(({ key, ...chip }) => (
        <Chip key={key} {...chip} />
      ))}

      <View style={{ flex: 1 }} />

      {rank ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="labelSm" color="textSecondary" numberOfLines={1}>
            {rank.name}
          </Text>
          <View
            style={{
              width: 68,
              height: 4,
              borderRadius: 2,
              marginTop: 3,
              backgroundColor: theme.colors.surfaceSunk,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(rank.ratio * 100, rank.ratio > 0 ? 4 : 0)}%`,
                height: '100%',
                backgroundColor: theme.colors.info,
              }}
            />
          </View>
        </View>
      ) : null}

      {trailing}
    </View>
  );
}

function Chip({ value, tone, icon: Icon }: Omit<HudChip, 'key'>) {
  const theme = useTheme();

  const color =
    tone === 'reward'
      ? theme.colors.reward
      : tone === 'success'
        ? theme.colors.success
        : tone === 'danger'
          ? theme.colors.danger
          : theme.colors.textSecondary;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon size={16} color={color} active />
      <Text variant="numeralSm" color="text" tabular>
        {value}
      </Text>
    </View>
  );
}
