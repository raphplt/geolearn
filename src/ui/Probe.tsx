import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { probe, type Sample } from '@/fx/probe';
import { useTheme } from '@/theme';
import { Text } from './Text';

/**
 * The read-out of `probe`, mounted only in development. Tap it to fold it back
 * to a single figure; long-press to clear the run before recording a journey.
 */
export function ProbeOverlay() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [samples, setSamples] = useState<readonly Sample[]>(probe.samples());
  const [open, setOpen] = useState(false);

  useEffect(() => probe.subscribe(setSamples), []);

  if (!__DEV__ || !probe.enabled) return null;

  const worst = samples.reduce((max, s) => Math.max(max, s.ms), 0);
  const breaches = samples.filter((s) => s.over).length;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: insets.top,
        alignItems: 'flex-end',
        paddingHorizontal: theme.space.sm,
      }}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        onLongPress={() => probe.clear()}
        accessibilityRole="button"
        accessibilityLabel="Sonde de fluidité"
        style={{
          maxWidth: '86%',
          paddingHorizontal: theme.space.sm,
          paddingVertical: theme.space.xs,
          borderRadius: theme.radius.sm,
          backgroundColor: breaches > 0 ? theme.colors.dangerSoft : theme.colors.surfaceSunk,
          borderWidth: theme.borderWidth.hair,
          borderColor: breaches > 0 ? theme.colors.danger : theme.colors.border,
        }}
      >
        <Text variant="numeralSm" color={breaches > 0 ? 'danger' : 'textSecondary'} tabular>
          {breaches} · {worst.toFixed(0)} ms
        </Text>

        {open
          ? samples.slice(0, 12).map((sample, i) => (
              <Text
                key={`${sample.at}-${i}`}
                variant="caption"
                color={sample.over ? 'danger' : 'textTertiary'}
                numberOfLines={1}
              >
                {sample.label} {sample.ms.toFixed(0)}
              </Text>
            ))
          : null}
      </Pressable>
    </View>
  );
}
