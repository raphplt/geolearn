import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HINTS, INKS, type HintItem, type InkItem } from '@/game/economy';
import { failure, milestone, tap } from '@/fx/haptics';
import { useProgress } from '@/store/progress';
import { INK_PALETTES } from '@/theme/inks';
import { useTheme } from '@/theme';
import { IconDoublon } from '@/ui/icons';
import { ListRow, ListSection } from '@/ui/List';
import { usePressResponse } from '@/ui/motion';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import Animated from 'react-native-reanimated';

export default function Comptoir() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const purse = useProgress((s) => s.purse);
  const buyHint = useProgress((s) => s.buyHint);
  const buyInk = useProgress((s) => s.buyInk);
  const selectInk = useProgress((s) => s.selectInk);

  const [preview, setPreview] = useState<InkItem | null>(null);

  const settle = (ok: boolean) => {
    if (ok) milestone();
    else failure();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <ScreenHeader
        eyebrow="Comptoir"
        title="Réserve"
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
            <IconDoublon size={18} color={theme.colors.reward} active />
            <Text variant="numeral" tabular>
              {purse.doublons}
            </Text>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ListSection
          title="Indices"
          footer="Un indice se consomme dans la partie où il est employé."
          style={{ marginTop: theme.space.md }}
        >
          {HINTS.map((hint, i) => (
            <HintRow
              key={hint.id}
              item={hint}
              first={i === 0}
              held={purse.hints[hint.id] ?? 0}
              affordable={purse.doublons >= hint.price}
              onBuy={() => settle(buyHint(hint.id, hint.price))}
            />
          ))}
        </ListSection>

        <ListSection
          title="Encres de carte"
          footer="Une encre ne change que les couleurs de l’atlas. Rien n’accélère la progression."
          style={{ marginTop: theme.space.xl }}
        >
          {INKS.map((ink, i) => (
            <InkRow
              key={ink.id}
              item={ink}
              first={i === 0}
              owned={purse.inks.includes(ink.id)}
              worn={purse.ink === ink.id}
              affordable={purse.doublons >= ink.price}
              onBuy={() => settle(buyInk(ink.id, ink.price))}
              onWear={() => {
                tap();
                selectInk(ink.id);
              }}
              onPreview={() => {
                tap();
                setPreview(ink);
              }}
            />
          ))}
        </ListSection>
      </ScrollView>

      <Sheet
        visible={Boolean(preview)}
        onClose={() => setPreview(null)}
        eyebrow="Encre"
        title={preview?.name}
      >
        {preview ? (
          <View
            style={{
              paddingHorizontal: theme.space.xl,
              paddingTop: theme.space.md,
              gap: theme.space.md,
            }}
          >
            <Swatches inkId={preview.id} height={96} />
            <Text variant="body" color="textSecondary">
              {preview.detail}
            </Text>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function HintRow({
  item,
  first,
  held,
  affordable,
  onBuy,
}: {
  item: HintItem;
  first: boolean;
  held: number;
  affordable: boolean;
  onBuy: () => void;
}) {
  return (
    <ListRow
      first={first}
      title={item.name}
      detail={item.detail}
      meta={held > 0 ? `×${held}` : undefined}
      trailing={
        <PriceTag
          price={item.price}
          affordable={affordable}
          onPress={onBuy}
          label={`Acheter ${item.name}`}
        />
      }
    />
  );
}

function InkRow({
  item,
  first,
  owned,
  worn,
  affordable,
  onBuy,
  onWear,
  onPreview,
}: {
  item: InkItem;
  first: boolean;
  owned: boolean;
  worn: boolean;
  affordable: boolean;
  onBuy: () => void;
  onWear: () => void;
  onPreview: () => void;
}) {
  const theme = useTheme();

  return (
    <ListRow
      first={first}
      title={item.name}
      detail={item.detail}
      onPress={onPreview}
      leading={<Swatches inkId={item.id} height={34} />}
      trailing={
        owned ? (
          <Pressable
            onPress={worn ? undefined : onWear}
            disabled={worn}
            accessibilityRole="button"
            accessibilityLabel={worn ? `${item.name}, encre portée` : `Porter ${item.name}`}
            style={{
              paddingHorizontal: theme.space.md,
              minHeight: theme.hitTarget.min - 10,
              justifyContent: 'center',
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
          <PriceTag
            price={item.price}
            affordable={affordable}
            onPress={onBuy}
            label={`Acheter ${item.name}`}
          />
        )
      }
    />
  );
}

function Swatches({ inkId, height }: { inkId: InkItem['id']; height: number }) {
  const theme = useTheme();
  const palette = INK_PALETTES[inkId][theme.scheme];

  const colors = [
    palette.mapWater ?? theme.colors.mapWater,
    palette.mapLandIdle ?? theme.colors.mapLandIdle,
    palette.mapLand ?? theme.colors.mapLand,
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
        borderWidth: theme.borderWidth.hair,
        borderColor: theme.colors.border,
      }}
    >
      {colors.map((color, i) => (
        <View key={i} style={{ width: height * 0.42, height, backgroundColor: color }} />
      ))}
    </View>
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
  const press = usePressResponse(0.05);

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${price} doublons`}
        accessibilityState={{ disabled: !affordable }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: theme.space.md,
          minHeight: theme.hitTarget.min - 10,
          borderRadius: theme.radius.pill,
          backgroundColor: affordable ? theme.colors.rewardSoft : theme.colors.surfaceSunk,
          borderWidth: theme.borderWidth.hair,
          borderColor: affordable ? theme.colors.reward : theme.colors.borderSoft,
          opacity: affordable ? 1 : theme.opacity.muted,
        }}
      >
        <IconDoublon
          size={14}
          color={affordable ? theme.colors.reward : theme.colors.textTertiary}
          active={affordable}
        />
        <Text variant="numeralSm" color={affordable ? 'text' : 'textTertiary'} tabular>
          {price}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
