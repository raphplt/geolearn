import { Pressable, View, type ViewProps } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { IconAtlas, IconBrevet, IconCabine, IconCap, type IconProps } from '@/ui/icons';

const TABS: Record<string, { label: string; icon: (props: IconProps) => React.ReactElement }> = {
  index: { label: 'Cap', icon: IconCap },
  atlas: { label: 'Atlas', icon: IconAtlas },
  brevets: { label: 'Brevets', icon: IconBrevet },
  cabine: { label: 'Cabine', icon: IconCabine },
};

export function PaperTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <TabBarShell>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const isFocused = state.index === index;

        return (
          <TabButton
            key={route.key}
            label={tab.label}
            icon={tab.icon}
            isFocused={isFocused}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                tap();
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </TabBarShell>
  );
}

function TabBarShell({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...rest}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'stretch',
          backgroundColor: theme.colors.surface,
          borderTopWidth: theme.borderWidth.thin,
          borderTopColor: theme.colors.border,
          paddingTop: theme.space.sm,
          paddingBottom: insets.bottom + theme.space.sm,
          paddingHorizontal: theme.space.xs,
          shadowColor: '#1E1610',
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -3 },
          elevation: 12,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          backgroundColor: theme.colors.bevel,
          opacity: theme.scheme === 'dark' ? 1 : 0.6,
        }}
      />
      {children}
    </View>
  );
}

function TabButton({
  label,
  icon: Icon,
  isFocused,
  onPress,
}: {
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  isFocused: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.08 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, theme.motion.spring.snappy);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, theme.motion.spring.snappy);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: theme.hitTarget.comfortable,
        gap: theme.space.xxs,
      }}
    >
      <Animated.View
        style={[
          {
            width: 46,
            height: 30,
            borderRadius: theme.radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isFocused ? theme.colors.rewardSoft : 'transparent',
            borderWidth: isFocused ? theme.borderWidth.hair : 0,
            borderColor: theme.colors.reward,
          },
          animatedStyle,
        ]}
      >
        <Icon
          size={22}
          active={isFocused}
          color={isFocused ? theme.colors.rewardStrong : theme.colors.textTertiary}
        />
      </Animated.View>
      <Text variant="labelSm" color={isFocused ? 'text' : 'textTertiary'}>
        {label}
      </Text>
    </Pressable>
  );
}
