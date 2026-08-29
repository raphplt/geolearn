import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { HintId } from '@/game/economy';
import type { Question } from '@/game/questions';
import { useTheme } from '@/theme';
import { usePressResponse } from '@/ui/motion';
import { Text } from '@/ui/Text';

/**
 * What the player can still do about the question in front of them: spend a
 * hint, or answer it without pointing at the map.
 */
export function HintBar({
  question,
  held,
  used,
  locked,
  onDrop,
  onSound,
  onList,
}: {
  question: Question;
  held: Partial<Record<HintId, number>>;
  used: { dropped: boolean; sounded: boolean };
  locked: boolean;
  onDrop: () => void;
  onSound: () => void;
  onList?: () => void;
}) {
  const theme = useTheme();

  const canDrop =
    question.mode === 'choice' && !used.dropped && (held.delester ?? 0) > 0 && !locked;
  const canSound = question.mode === 'locate' && !used.sounded && (held.sonder ?? 0) > 0 && !locked;
  const canList = Boolean(onList) && !locked;

  if (!canDrop && !canSound && !canList) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.space.sm,
        paddingHorizontal: theme.space.lg,
        paddingTop: theme.space.sm,
      }}
    >
      {canDrop ? <Chip label="Délester" count={held.delester ?? 0} onPress={onDrop} /> : null}
      {canSound ? <Chip label="Sonder" count={held.sonder ?? 0} onPress={onSound} /> : null}
      {canList ? <Chip label="Répondre par une liste" onPress={onList!} /> : null}
    </View>
  );
}

function Chip({ label, count, onPress }: { label: string; count?: number; onPress: () => void }) {
  const theme = useTheme();
  const press = usePressResponse(0.04);

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={count === undefined ? label : `${label}, ${count} en réserve`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.xs,
          minHeight: theme.hitTarget.min - 8,
          paddingHorizontal: theme.space.md,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.infoSoft,
          borderWidth: theme.borderWidth.hair,
          borderColor: theme.colors.info,
        }}
      >
        <Text variant="labelSm" color="info">
          {label}
        </Text>
        {count === undefined ? null : (
          <Text variant="numeralSm" color="info" tabular>
            ×{count}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
