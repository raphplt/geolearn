import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HINTS, INKS, type HintItem, type InkItem } from '@/game/economy';
import { failure, milestone, tap } from '@/fx/haptics';
import { useProgress } from '@/store/progress';
import { INK_PALETTES } from '@/theme/inks';
import { useTheme } from '@/theme';
import { IconDoublon } from '@/ui/icons';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

export default function Comptoir() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const purse = useProgress((s) => s.purse);
  const buyHint = useProgress((s) => s.buyHint);
  const buyInk = useProgress((s) => s.buyInk);
  const selectInk = useProgress((s) => s.selectInk);

  const attempt = (ok: boolean) => {
    if (ok) milestone();
    else failure();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.space.lg,
          minHeight: theme.hitTarget.comfortable,
        }}
      >
        <Text variant="cartouche" color="textTertiary">
          Comptoir
        </Text>
        <Pressable
          onPress={() => {
            tap();
            router.back();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        >
          <Text variant="title" color="textTertiary">
            ✕
          </Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: theme.space.lg, paddingBottom: theme.space.md }}>
        <PaperSurface
          tone="raised"
          bordered
          radius="md"
          grain={0.25}
          elevation="sheet"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            padding: theme.space.md,
          }}
        >
          <IconDoublon size={26} color={theme.colors.reward} active />
          <View style={{ flex: 1 }}>
            <Text variant="numeral" tabular>
              {purse.doublons}
            </Text>
          </View>
        </PaperSurface>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: insets.bottom + theme.space.xxl,
          gap: theme.space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300)}>
          <Section title="Indices" />
          <View style={{ gap: theme.space.sm }}>
            {HINTS.map((hint) => (
              <HintRow
                key={hint.id}
                item={hint}
                held={purse.hints[hint.id] ?? 0}
                affordable={purse.doublons >= hint.price}
                onBuy={() => attempt(buyHint(hint.id, hint.price))}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(300)}>
          <Section title="Encres de carte" />
          <View style={{ gap: theme.space.sm }}>
            {INKS.map((ink) => (
              <InkRow
                key={ink.id}
                item={ink}
                owned={purse.inks.includes(ink.id)}
                worn={purse.ink === ink.id}
                affordable={purse.doublons >= ink.price}
                onBuy={() => attempt(buyInk(ink.id, ink.price))}
                onWear={() => {
                  tap();
                  selectInk(ink.id);
                }}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Section({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text variant="cartouche" color="textTertiary" style={{ marginBottom: theme.space.md }}>
      {title}
    </Text>
  );
}

function HintRow({
  item,
  held,
  affordable,
  onBuy,
}: {
  item: HintItem;
  held: number;
  affordable: boolean;
  onBuy: () => void;
}) {
  const theme = useTheme();

  return (
    <PaperSurface
      tone="raised"
      bordered
      radius="md"
      grain={0.2}
      elevation="sheet"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        padding: theme.space.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <Text variant="label">{item.name}</Text>
          {held > 0 ? (
            <View
              style={{
                paddingHorizontal: theme.space.sm,
                paddingVertical: 1,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.successSoft,
                borderWidth: theme.borderWidth.hair,
                borderColor: theme.colors.success,
              }}
            >
              <Text variant="caption" color="success" tabular>
                ×{held}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <PriceTag price={item.price} affordable={affordable} onPress={onBuy} label={`Acheter ${item.name}`} />
    </PaperSurface>
  );
}

function InkRow({
  item,
  owned,
  worn,
  affordable,
  onBuy,
  onWear,
}: {
  item: InkItem;
  owned: boolean;
  worn: boolean;
  affordable: boolean;
  onBuy: () => void;
  onWear: () => void;
}) {
  const theme = useTheme();
  const palette = INK_PALETTES[item.id][theme.scheme];

  const swatches = [
    palette.mapWater ?? theme.colors.mapWater,
    palette.mapLandIdle ?? theme.colors.mapLandIdle,
    palette.mapLand ?? theme.colors.mapLand,
  ];

  return (
    <PaperSurface
      tone="raised"
      bordered
      radius="md"
      grain={0.2}
      elevation="sheet"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        padding: theme.space.md,
        borderColor: worn ? theme.colors.borderStrong : theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {swatches.map((color, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 34,
              borderRadius: 3,
              backgroundColor: color,
              borderWidth: theme.borderWidth.hair,
              borderColor: theme.colors.borderSoft,
            }}
          />
        ))}
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="label">{item.name}</Text>
      </View>

      {owned ? (
        <Pressable
          onPress={worn ? undefined : onWear}
          disabled={worn}
          accessibilityRole="button"
          accessibilityLabel={worn ? `${item.name}, encre portée` : `Porter ${item.name}`}
          style={{
            paddingHorizontal: theme.space.md,
            paddingVertical: theme.space.sm,
            borderRadius: theme.radius.pill,
            backgroundColor: worn ? theme.colors.successSoft : theme.colors.surfaceSunk,
            borderWidth: theme.borderWidth.hair,
            borderColor: worn ? theme.colors.success : theme.colors.borderStrong,
          }}
        >
          <Text variant="labelSm" color={worn ? 'success' : 'text'}>
            {worn ? 'Portée' : 'Porter'}
          </Text>
        </Pressable>
      ) : (
        <PriceTag price={item.price} affordable={affordable} onPress={onBuy} label={`Acheter ${item.name}`} />
      )}
    </PaperSurface>
  );
}

function PriceTag({
  price,
  affordable,
  onPress,
  label,
}: {
  price: number;
  affordable: boolean;
  onPress: () => void;
  label: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${price} doublons`}
      accessibilityState={{ disabled: !affordable }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
        borderRadius: theme.radius.pill,
        backgroundColor: affordable ? theme.colors.rewardSoft : theme.colors.surfaceSunk,
        borderWidth: theme.borderWidth.hair,
        borderColor: affordable ? theme.colors.reward : theme.colors.borderSoft,
        opacity: affordable ? 1 : theme.opacity.muted,
      }}
    >
      <IconDoublon size={14} color={affordable ? theme.colors.reward : theme.colors.textTertiary} active={affordable} />
      <Text variant="numeralSm" color={affordable ? 'text' : 'textTertiary'} tabular>
        {price}
      </Text>
    </Pressable>
  );
}
