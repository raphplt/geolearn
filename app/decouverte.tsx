import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import type { Country, Department, Territory } from '@/data/types';
import { currentRung, undiscovered } from '@/game/ladder';
import { seedFrom } from '@/game/rng';
import { discoveryConfig, DISCOVERY_BATCH } from '@/game/session';
import { AtlasMap } from '@/map/AtlasMap';
import { focusFrame } from '@/map/framing';
import { warmHitIndex } from '@/map/geometry';
import { selectFloor, useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Flag } from '@/ui/Flag';
import { useReducedMotion } from '@/ui/motion';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';

const SWIPE_DISTANCE = 60;

export default function Decouverte() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const settings = useProgress((s) => s.settings);
  const cards = useProgress((s) => s.cards);
  const start = useSession((s) => s.start);

  const atlasId = settings.lastAtlas;
  const atlas = ATLASES[atlasId];
  const floor = useProgress((s) => selectFloor(s, atlasId));

  const rungIndex = useMemo(() => currentRung(atlasId, cards, floor), [atlasId, cards, floor]);

  const [batch] = useState<Territory[]>(() =>
    undiscovered(atlasId, cards, rungIndex).slice(0, DISCOVERY_BATCH),
  );

  const [index, setIndex] = useState(0);
  const territory = batch[index];

  useEffect(() => {
    warmHitIndex(atlas);
  }, [atlas]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(batch.length - 1, Math.max(0, i + delta)));
    },
    [batch.length],
  );

  const verify = useCallback(() => {
    start(
      discoveryConfig(
        atlasId,
        seedFrom(`discovery:${atlasId}:${batch.map((t) => t.id).join(',')}`),
        rungIndex,
        batch.map((t) => t.id),
      ),
    );
    router.replace('/play');
  }, [start, atlasId, batch, rungIndex]);

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-24, 24])
        .onEnd((event) => {
          if (event.translationX < -SWIPE_DISTANCE) runOnJS(go)(1);
          else if (event.translationX > SWIPE_DISTANCE) runOnJS(go)(-1);
        }),
    [go],
  );

  const frame = useMemo(
    () => (territory ? focusFrame(atlas, territory.id) : undefined),
    [atlas, territory],
  );

  const states = useMemo(
    () => (territory ? ({ [territory.id]: 'target' } as const) : undefined),
    [territory],
  );

  if (!territory) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.space.xl,
          gap: theme.space.lg,
        }}
      >
        <Text variant="title" align="center">
          Tout le palier a été rencontré
        </Text>
        <Button label="Revenir au port" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const last = index === batch.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <ScreenHeader
        eyebrow="Découverte"
        title={`${index + 1} sur ${batch.length}`}
        onLeading={() => router.replace('/')}
        trailing={<Dots total={batch.length} at={index} />}
      />

      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1, paddingHorizontal: theme.space.lg, gap: theme.space.md }}>
          {/*
            The map keeps its identity across steps: only the frame and the
            highlighted shape change, so nothing is torn down and rebuilt.
          */}
          <AtlasMap
            atlas={atlas}
            states={states}
            viewBox={frame}
            labels="none"
            zoomable={false}
            style={{ flex: 1 }}
          />

          <Fiche atlasId={atlasId} territory={territory} step={index} reduced={reduced} />
        </View>
      </GestureDetector>

      <View
        style={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: insets.bottom + theme.space.lg,
          paddingTop: theme.space.md,
        }}
      >
        <Button
          label={last ? `Vérifier ces ${batch.length}` : 'Territoire suivant'}
          size="lg"
          tone="success"
          block
          onPress={() => {
            if (last) verify();
            else go(1);
          }}
        />
      </View>
    </View>
  );
}

function Dots({ total, at }: { total: number; at: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === at ? 16 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i <= at ? theme.colors.success : theme.colors.surfaceSunk,
          }}
        />
      ))}
    </View>
  );
}

/**
 * The card is one persistent surface. Its content slides a few points in the
 * direction of travel; it is never unmounted and remounted between steps.
 */
function Fiche({
  atlasId,
  territory,
  step,
  reduced,
}: {
  atlasId: AtlasId;
  territory: Territory;
  step: number;
  reduced: boolean;
}) {
  const theme = useTheme();
  const isFrance = atlasId === 'france-departments';
  const dept = isFrance ? (territory as Department) : null;
  const country = isFrance ? null : (territory as Country);

  const shift = useSharedValue(0);
  const previous = useRef(step);

  useEffect(() => {
    const direction = step >= previous.current ? 1 : -1;
    previous.current = step;
    if (reduced) return;
    shift.value = 18 * direction;
    shift.value = withTiming(0, {
      duration: theme.motion.duration.base,
      easing: Easing.out(Easing.quad),
    });
  }, [step, reduced, shift, theme.motion.duration.base]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  return (
    <View
      style={{
        paddingVertical: theme.space.md,
        borderTopWidth: theme.borderWidth.hair,
        borderTopColor: theme.colors.border,
      }}
    >
      <Animated.View style={style}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          {country ? (
            <Flag cca2={country.cca2} height={40} label={country.name} />
          ) : dept ? (
            <View
              style={{
                minWidth: 48,
                paddingHorizontal: theme.space.sm,
                paddingVertical: theme.space.xs,
                borderRadius: theme.radius.sm,
                alignItems: 'center',
                backgroundColor: theme.colors.surfaceSunk,
              }}
            >
              <Text variant="numeral" tabular>
                {dept.id}
              </Text>
            </View>
          ) : null}

          <Text variant="titleLg" style={{ flex: 1 }} numberOfLines={2}>
            {territory.name}
          </Text>
        </View>

        <View style={{ marginTop: theme.space.md, gap: theme.space.xs }}>
          <Line
            label={isFrance ? 'Chef-lieu' : 'Capitale'}
            value={dept?.prefecture ?? country?.capital ?? '—'}
          />
          <Line
            label={isFrance ? 'Région' : 'Sous-région'}
            value={dept?.region ?? country?.subregion ?? '—'}
          />
          {country ? (
            <Line label="Population" value={formatPopulation(country.population)} />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.md }}>
      <Text variant="caption" color="textTertiary" style={{ width: 92 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatPopulation(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 100 ? Math.round(millions) : millions.toFixed(1).replace('.', ',')} millions`;
  }
  return `${Math.round(value / 1000)} 000`;
}
