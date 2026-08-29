import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';
import { IconBack, IconClose } from './icons';
import { Text } from './Text';

export type ScreenHeaderProps = {
  title?: string;
  eyebrow?: string;
  /** `back` for a pushed level, `close` only for a genuine modal. */
  leading?: 'back' | 'close' | 'none';
  onLeading?: () => void;
  trailing?: React.ReactNode;
  centered?: boolean;
};

/**
 * Context on the left, one clear way out, an optional action on the right.
 * A cross is never used as a substitute for "back".
 */
export function ScreenHeader({
  title,
  eyebrow,
  leading = 'back',
  onLeading,
  trailing,
  centered = false,
}: ScreenHeaderProps) {
  const theme = useTheme();

  const Icon = leading === 'close' ? IconClose : IconBack;
  const label = leading === 'close' ? 'Fermer' : 'Retour';

  const goBack = () => {
    tap();
    if (onLeading) {
      onLeading();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.sm,
        paddingRight: theme.space.lg,
        minHeight: theme.hitTarget.comfortable,
      }}
    >
      {leading === 'none' ? (
        <View style={{ width: theme.space.sm }} />
      ) : (
        <Pressable
          onPress={goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={{
            width: theme.hitTarget.min,
            height: theme.hitTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={24} color={theme.colors.textSecondary} />
        </Pressable>
      )}

      <View style={{ flex: 1, alignItems: centered ? 'center' : 'flex-start' }}>
        {eyebrow ? (
          <Text variant="cartouche" color="textTertiary" numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text variant="title" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      {trailing}
    </View>
  );
}
