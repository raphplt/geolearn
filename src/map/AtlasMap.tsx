import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Atlas, BBox, Territory } from '@/data/types';
import { tap } from '@/fx/haptics';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { buildHitIndex, hitTest } from './geometry';

export type TerritoryState =
  | 'idle'
  | 'target'
  | 'correct'
  | 'wrong'
  | 'reveal'
  | 'mastered'
  | 'sealed';

export type LabelPolicy =
  | 'none'
  | 'adaptive'
  | 'all';

export type AtlasMapProps = {
  atlas: Atlas<Territory>;
  states?: Readonly<Record<string, TerritoryState>>;
  onSelect?: (territoryId: string) => void;
  viewBox?: BBox;
  labels?: LabelPolicy;
  zoomable?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TOUCH_TOLERANCE = 90;

const MAX_ZOOM = 12;

const LABEL_POINTS = 11;

const LABEL_CHAR_WIDTH = 0.46;

export function AtlasMap({
  atlas,
  states,
  onSelect,
  viewBox,
  labels = 'none',
  zoomable = true,
  style,
}: AtlasMapProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const index = useMemo(() => (onSelect ? buildHitIndex(atlas) : null), [atlas, onSelect]);

  const fullFrame = useMemo<BBox>(
    () => viewBox ?? [0, 0, atlas.width, atlas.height],
    [viewBox, atlas.width, atlas.height],
  );

  const [frame, setFrame] = useState<BBox>(fullFrame);
  useEffect(() => setFrame(fullFrame), [fullFrame]);

  const frameWidth = frame[2] - frame[0];
  const frameHeight = frame[3] - frame[1];

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const fit = useMemo(() => {
    if (size.width === 0 || size.height === 0) return null;
    const k = Math.min(size.width / frameWidth, size.height / frameHeight);
    return {
      k,
      offsetX: (size.width - frameWidth * k) / 2,
      offsetY: (size.height - frameHeight * k) / 2,
    };
  }, [size.width, size.height, frameWidth, frameHeight]);

  const commit = useCallback(
    (s: number, tx: number, ty: number) => {
      if (!fit) return;
      if (s === 1 && tx === 0 && ty === 0) return;
      const fullWidth = fullFrame[2] - fullFrame[0];
      const fullHeight = fullFrame[3] - fullFrame[1];

      let width = frameWidth / s;
      let height = frameHeight / s;

      const maxWidth = fullWidth;
      const minWidth = fullWidth / MAX_ZOOM;
      const clamped = Math.min(maxWidth, Math.max(minWidth, width));
      const ratio = clamped / width;
      width = clamped;
      height *= ratio;

      let x = frame[0] + (frameWidth / 2) * (1 - 1 / s) - tx / (fit.k * s);
      let y = frame[1] + (frameHeight / 2) * (1 - 1 / s) - ty / (fit.k * s);

      x = Math.min(fullFrame[0] + fullWidth - width, Math.max(fullFrame[0], x));
      y = Math.min(fullFrame[1] + fullHeight - height, Math.max(fullFrame[1], y));

      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      setFrame([x, y, x + width, y + height]);
    },
    [fit, frame, frameWidth, frameHeight, fullFrame, scale, translateX, translateY],
  );

  const select = useCallback(
    (x: number, y: number) => {
      if (!onSelect || !fit || !index) return;
      const point: [number, number] = [
        frame[0] + (x - fit.offsetX) / fit.k,
        frame[1] + (y - fit.offsetY) / fit.k,
      ];
      const tolerance = TOUCH_TOLERANCE * (frameWidth / atlas.width);
      const hit = hitTest(index, point[0], point[1], { tolerance });
      if (hit) onSelect(hit);
    },
    [onSelect, fit, frame, frameWidth, atlas.width, index],
  );

  const reset = useCallback(() => setFrame(fullFrame), [fullFrame]);

  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(300)
      .maxDistance(12)
      .onEnd((event) => runOnJS(select)(event.x, event.y));

    if (!zoomable) return tap;

    const pan = Gesture.Pan()
      .averageTouches(true)
      .minDistance(6)
      .onChange((event) => {
        translateX.value += event.changeX;
        translateY.value += event.changeY;
      })
      .onEnd(() => runOnJS(commit)(scale.value, translateX.value, translateY.value));

    const pinch = Gesture.Pinch()
      .onChange((event) => {
        scale.value *= event.scaleChange;
        const fx = event.focalX - size.width / 2;
        const fy = event.focalY - size.height / 2;
        translateX.value -= fx * (event.scaleChange - 1);
        translateY.value -= fy * (event.scaleChange - 1);
      })
      .onEnd(() => runOnJS(commit)(scale.value, translateX.value, translateY.value));

    if (onSelect) return Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(300)
      .onEnd(() => {
        scale.value = withTiming(1, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
        runOnJS(reset)();
      });

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pan, pinch));
  }, [
    zoomable,
    onSelect,
    select,
    commit,
    reset,
    scale,
    translateX,
    translateY,
    size.width,
    size.height,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const atlasPerPoint = frameWidth / (size.width > 0 ? size.width : 360);
  const zoomedIn = frameWidth < (fullFrame[2] - fullFrame[0]) * 0.66;
  const pt = useCallback((points: number) => points * atlasPerPoint, [atlasPerPoint]);

  const shapes = useMemo(
    () =>
      atlas.territories.map((t) =>
        t.d ? <TerritoryShape key={t.id} d={t.d} state={states?.[t.id] ?? 'idle'} /> : null,
      ),
    [atlas.territories, states],
  );

  const highlights = useMemo(
    () =>
      atlas.territories.map((t) => {
        const state = states?.[t.id] ?? 'idle';
        if (!t.d || state === 'idle' || state === 'mastered') return null;
        return (
          <TerritoryOutline
            key={`${t.id}-top`}
            d={t.d}
            state={state}
            sealed={state === 'sealed'}
          />
        );
      }),
    [atlas.territories, states],
  );

  const labelled = useMemo(() => {
    if (labels === 'none') return [];

    return atlas.territories.filter((t) => {
      if (t.d === '') return false;

      if (
        t.label[0] < frame[0] ||
        t.label[0] > frame[2] ||
        t.label[1] < frame[1] ||
        t.label[1] > frame[3]
      ) {
        return false;
      }
      if (labels === 'all') return true;

      const spanPoints = (t.bbox[2] - t.bbox[0]) / atlasPerPoint;
      const textPoints = t.name.length * LABEL_POINTS * LABEL_CHAR_WIDTH;
      return spanPoints > textPoints * 1.1;
    });
  }, [labels, atlas.territories, atlasPerPoint, frame]);

  const content = (
    <Animated.View
      style={[{ flex: 1 }, animatedStyle]}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`${frame[0]} ${frame[1]} ${frameWidth} ${frameHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {atlas.frame ? (
          <Path
            d={atlas.frame}
            fill={theme.colors.mapWater}
            stroke={theme.colors.borderSoft}
            strokeWidth={pt(1)}
          />
        ) : (
          <Rect
            x={fullFrame[0] - atlas.width}
            y={fullFrame[1] - atlas.height}
            width={atlas.width * 3}
            height={atlas.height * 3}
            fill={theme.colors.mapWater}
          />
        )}

        {atlas.graticule ? (
          <Path
            d={atlas.graticule}
            fill="none"
            stroke={theme.colors.mapGraticule}
            strokeWidth={pt(0.5)}
            opacity={0.6}
          />
        ) : null}

        {atlas.outline && !zoomedIn ? (
          <G stroke={theme.colors.mapWaterDeep} fill="none" strokeLinejoin="round">
            <Path d={atlas.outline} strokeWidth={pt(16)} opacity={0.18} />
            <Path d={atlas.outline} strokeWidth={pt(6)} opacity={0.34} />
          </G>
        ) : null}

        {atlas.insets.map((inset) => (
          <G key={inset.id}>
            <Rect
              x={inset.frame[0]}
              y={inset.frame[1]}
              width={inset.frame[2] - inset.frame[0]}
              height={inset.frame[3] - inset.frame[1]}
              fill={theme.colors.mapWater}
              stroke={theme.colors.mapStrokeStrong}
              strokeWidth={pt(1)}
              rx={pt(6)}
              opacity={0.96}
            />
          </G>
        ))}

        <G stroke={theme.colors.mapStroke} strokeWidth={pt(0.6)} strokeLinejoin="round">
          {shapes}
        </G>

        {atlas.outline ? (
          <Path
            d={atlas.outline}
            fill="none"
            stroke={theme.colors.mapStrokeStrong}
            strokeWidth={pt(1.2)}
            strokeLinejoin="round"
            opacity={0.85}
          />
        ) : null}

        <G strokeLinejoin="round" fill="none" opacity={0.95}>
          {highlights}
        </G>

        {labelled.map((t) => (
          <MapLabel
            key={`${t.id}-label`}
            x={t.label[0]}
            y={t.label[1]}
            size={pt(LABEL_POINTS)}
            halo={pt(2.4)}
            text={t.name}
          />
        ))}
      </Svg>
    </Animated.View>
  );

  const zoomed = frameWidth < (fullFrame[2] - fullFrame[0]) - 1;

  return (
    <View
      style={[
        {
          overflow: 'hidden',
          borderRadius: theme.radius.lg,
          backgroundColor: atlas.frame ? theme.colors.canvas : theme.colors.mapWater,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.border,
        },
        style,
      ]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Carte : ${atlas.name}`}
      accessibilityHint={
        onSelect ? 'Touchez un territoire pour le désigner. Pincez pour zoomer.' : undefined
      }
    >
      {onSelect || zoomable ? (
        <GestureDetector gesture={gesture}>{content}</GestureDetector>
      ) : (
        content
      )}

      {zoomable && zoomed ? (
        <Pressable
          onPress={() => {
            tap();
            scale.value = 1;
            translateX.value = 0;
            translateY.value = 0;
            reset();
          }}
          accessibilityRole="button"
          accessibilityLabel="Recadrer la carte"
          style={{
            position: 'absolute',
            right: theme.space.md,
            top: theme.space.md,
            paddingHorizontal: theme.space.md,
            paddingVertical: theme.space.sm,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surfaceRaised,
            borderWidth: theme.borderWidth.hair,
            borderColor: theme.colors.borderStrong,
            ...theme.elevation.lifted,
          }}
        >
          <Text variant="labelSm">Recadrer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const TerritoryShape = memo(function TerritoryShape({
  d,
  state,
}: {
  d: string;
  state: TerritoryState;
}) {
  const theme = useTheme();
  const fill =
    state === 'correct'
      ? theme.colors.mapCorrect
      : state === 'wrong'
        ? theme.colors.mapWrong
        : state === 'target' || state === 'reveal'
          ? theme.colors.mapTarget
          : state === 'mastered' || state === 'sealed'
            ? theme.colors.mapLand
            : theme.colors.mapLandIdle;

  return <Path d={d} fill={fill} />;
});

const TerritoryOutline = memo(function TerritoryOutline({
  d,
  state,
  sealed,
}: {
  d: string;
  state: TerritoryState;
  sealed: boolean;
}) {
  const theme = useTheme();
  const stroke =
    state === 'correct'
      ? theme.colors.success
      : state === 'wrong'
        ? theme.colors.danger
        : theme.colors.reward;

  return <Path d={d} fill="none" stroke={stroke} strokeWidth={sealed ? 5 : 9} />;
});

const MapLabel = memo(function MapLabel({
  x,
  y,
  text,
  size,
  halo,
}: {
  x: number;
  y: number;
  text: string;
  size: number;
  halo: number;
}) {
  const theme = useTheme();
  const common = {
    x,
    y,
    fontSize: size,
    textAnchor: 'middle' as const,
    fontFamily: theme.fontFamily.bodySemi,
  };

  return (
    <G>
      <SvgText
        {...common}
        fill="none"
        stroke={theme.colors.mapLabelHalo}
        strokeWidth={halo}
        strokeLinejoin="round"
        opacity={0.9}
      >
        {text}
      </SvgText>
      <SvgText {...common} fill={theme.colors.mapLabel}>
        {text}
      </SvgText>
    </G>
  );
});
