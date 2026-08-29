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
import { useTheme, type Colors } from '@/theme';
import { Text } from '@/ui/Text';
import { buildHitIndex, hitTest, peekHitIndex, type HitIndex } from './geometry';

export type TerritoryState =
  'idle' | 'target' | 'correct' | 'wrong' | 'reveal' | 'mastered' | 'sealed';

export type LabelPolicy = 'none' | 'adaptive' | 'all';

export type AtlasMapProps = {
  atlas: Atlas<Territory>;
  states?: Readonly<Record<string, TerritoryState>>;
  onSelect?: (territoryId: string) => void;
  viewBox?: BBox;
  labels?: LabelPolicy;
  zoomable?: boolean;
  /** A frame is a physical object; the Atlas tab draws the map itself instead. */
  framed?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TOUCH_TOLERANCE = 90;

const MAX_ZOOM = 12;

const LABEL_POINTS = 11;

const LABEL_CHAR_WIDTH = 0.46;

const DENSE_STATES = 24;

export function AtlasMap({
  atlas,
  states,
  onSelect,
  viewBox,
  labels = 'none',
  zoomable = true,
  framed = true,
  style,
}: AtlasMapProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  /*
   * Decoding an atlas into pointable rings is the single most expensive thing
   * this component can do. It happens once per atlas, never during the render
   * that first needs it, and only where a territory can actually be touched.
   */
  const [index, setIndex] = useState<HitIndex | null>(() =>
    onSelect ? peekHitIndex(atlas) : null,
  );

  useEffect(() => {
    if (!onSelect) return;
    const warm = peekHitIndex(atlas);
    if (warm) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- already built, no work
      setIndex(warm);
      return;
    }
    /* Deliberately one tick late: the point is to keep it off this render. */
    const task = setTimeout(() => setIndex(buildHitIndex(atlas)), 0);
    return () => clearTimeout(task);
  }, [atlas, onSelect]);

  const fullFrame = useMemo<BBox>(
    () => viewBox ?? [0, 0, atlas.width, atlas.height],
    [viewBox, atlas.width, atlas.height],
  );

  /*
   * The frame follows the atlas until a gesture takes it over. Adjusting it
   * during render rather than in an effect matters here: every question changes
   * the viewBox, and an effect would cost a second commit each time.
   */
  const [frame, setFrame] = useState<BBox>(fullFrame);
  const [framedOn, setFramedOn] = useState<BBox>(fullFrame);
  if (framedOn !== fullFrame) {
    setFramedOn(fullFrame);
    setFrame(fullFrame);
  }

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
    const pick = Gesture.Tap()
      .maxDuration(300)
      .maxDistance(12)
      .onEnd((event) => runOnJS(select)(event.x, event.y));

    if (!zoomable) return pick;

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

    if (onSelect) return Gesture.Race(pick, Gesture.Simultaneous(pan, pinch));

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

  /*
   * Two regimes. A question colours one or two territories, so the resting map
   * stays memoised and a thin overlay is painted over it. The Atlas colours
   * almost everything, and a second full layer would double the tracing cost —
   * there, the single land layer carries the colours itself.
   */
  const dense = states !== undefined && Object.keys(states).length > DENSE_STATES;

  const atlasPerPoint = frameWidth / (size.width > 0 ? size.width : 360);
  const zoomedIn = frameWidth < (fullFrame[2] - fullFrame[0]) * 0.66;
  const pt = useCallback((points: number) => points * atlasPerPoint, [atlasPerPoint]);

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
    /* Rasterised only where the map is actually dragged and pinched. */
    <Animated.View
      style={[{ flex: 1 }, animatedStyle]}
      renderToHardwareTextureAndroid={zoomable}
      shouldRasterizeIOS={zoomable}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`${frame[0]} ${frame[1]} ${frameWidth} ${frameHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <MapGround
          atlas={atlas}
          colors={theme.colors}
          fullFrame={fullFrame}
          zoomedIn={zoomedIn}
          unit={atlasPerPoint}
        />

        <G stroke={theme.colors.mapStroke} strokeWidth={pt(0.6)} strokeLinejoin="round">
          <MapLand atlas={atlas} colors={theme.colors} states={dense ? states : undefined} />
          {dense ? null : <MapAccents atlas={atlas} states={states} colors={theme.colors} />}
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

        {/* Widths live on the groups, so zooming never rebuilds the rings. */}
        <G fill="none" strokeLinejoin="round" opacity={0.95}>
          <G strokeWidth={pt(5)}>
            <MapRings atlas={atlas} states={states} colors={theme.colors} thin={false} />
          </G>
          <G strokeWidth={pt(2.75)}>
            <MapRings atlas={atlas} states={states} colors={theme.colors} thin />
          </G>
        </G>

        {labelled.map((t) => (
          <MapLabel
            key={`${t.id}-label`}
            x={t.label[0]}
            y={t.label[1]}
            size={pt(LABEL_POINTS)}
            halo={pt(2.4)}
            text={t.name}
            fill={theme.colors.mapLabel}
            haloColor={theme.colors.mapLabelHalo}
            font={theme.fontFamily.bodySemi}
          />
        ))}
      </Svg>
    </Animated.View>
  );

  const zoomed = frameWidth < fullFrame[2] - fullFrame[0] - 1;

  return (
    <View
      style={[
        {
          overflow: 'hidden',
          backgroundColor: atlas.frame ? theme.colors.canvas : theme.colors.mapWater,
          ...(framed
            ? {
                borderRadius: theme.radius.lg,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border,
              }
            : null),
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

/**
 * Water, graticule, coastal halo and insets. Depends on the atlas and the
 * palette, never on the answer being played — so a question changes nothing
 * here and React skips the whole subtree.
 */
const MapGround = memo(function MapGround({
  atlas,
  colors,
  fullFrame,
  zoomedIn,
  unit,
}: {
  atlas: Atlas<Territory>;
  colors: Colors;
  fullFrame: BBox;
  zoomedIn: boolean;
  unit: number;
}) {
  const pt = (points: number): number => points * unit;

  return (
    <>
      {atlas.frame ? (
        <Path
          d={atlas.frame}
          fill={colors.mapWater}
          stroke={colors.borderSoft}
          strokeWidth={pt(1)}
        />
      ) : (
        <Rect
          x={fullFrame[0] - atlas.width}
          y={fullFrame[1] - atlas.height}
          width={atlas.width * 3}
          height={atlas.height * 3}
          fill={colors.mapWater}
        />
      )}

      {atlas.graticule ? (
        <Path
          d={atlas.graticule}
          fill="none"
          stroke={colors.mapGraticule}
          strokeWidth={pt(0.5)}
          opacity={0.6}
        />
      ) : null}

      {atlas.outline && !zoomedIn ? (
        <G stroke={colors.mapWaterDeep} fill="none" strokeLinejoin="round">
          <Path d={atlas.outline} strokeWidth={pt(16)} opacity={0.18} />
          <Path d={atlas.outline} strokeWidth={pt(6)} opacity={0.34} />
        </G>
      ) : null}

      {atlas.insets.map((inset) => (
        <Rect
          key={inset.id}
          x={inset.frame[0]}
          y={inset.frame[1]}
          width={inset.frame[2] - inset.frame[0]}
          height={inset.frame[3] - inset.frame[1]}
          fill={colors.mapWater}
          stroke={colors.mapStrokeStrong}
          strokeWidth={pt(1)}
          rx={pt(6)}
          opacity={0.96}
        />
      ))}
    </>
  );
});

/**
 * Every territory, in one pass. Without `states` it depends on the atlas and a
 * single colour, so panning, zooming and answering all leave it alone; with
 * them it carries the whole Atlas colouring without a second layer.
 */
const MapLand = memo(function MapLand({
  atlas,
  colors,
  states,
}: {
  atlas: Atlas<Territory>;
  colors: Colors;
  states?: Readonly<Record<string, TerritoryState>>;
}) {
  return (
    <>
      {atlas.territories.map((t) =>
        t.d ? <Path key={t.id} d={t.d} fill={fillFor(colors, states?.[t.id])} /> : null,
      )}
    </>
  );
});

const ACCENT: Record<Exclude<TerritoryState, 'idle'>, keyof Colors> = {
  target: 'mapTarget',
  reveal: 'mapTarget',
  correct: 'mapCorrect',
  wrong: 'mapWrong',
  mastered: 'mapLand',
  sealed: 'mapLand',
};

const OUTLINE: Partial<Record<TerritoryState, keyof Colors>> = {
  target: 'reward',
  reveal: 'reward',
  correct: 'success',
  wrong: 'danger',
  sealed: 'reward',
};

const fillFor = (colors: Colors, state: TerritoryState | undefined): string =>
  !state || state === 'idle' ? colors.mapLandIdle : colors[ACCENT[state]];

/** The sparse case: only the one or two territories a question is about. */
const MapAccents = memo(function MapAccents({
  atlas,
  states,
  colors,
}: {
  atlas: Atlas<Territory>;
  states?: Readonly<Record<string, TerritoryState>>;
  colors: Colors;
}) {
  if (!states) return null;

  const painted = atlas.territories
    .filter((t) => t.d && states[t.id] && states[t.id] !== 'idle')
    .map((t) => <Path key={t.id} d={t.d} fill={fillFor(colors, states[t.id])} />);

  return painted.length > 0 ? <>{painted}</> : null;
});

/**
 * The ring drawn around a territory whose state deserves one. Carries no width
 * of its own: the enclosing group holds it, so a zoom is one attribute change
 * rather than a hundred new elements.
 */
const MapRings = memo(function MapRings({
  atlas,
  states,
  colors,
  thin,
}: {
  atlas: Atlas<Territory>;
  states?: Readonly<Record<string, TerritoryState>>;
  colors: Colors;
  thin: boolean;
}) {
  if (!states) return null;

  const rings: React.ReactElement[] = [];

  for (const t of atlas.territories) {
    const state = states[t.id];
    if (!state || !t.d) continue;
    const edge = OUTLINE[state];
    if (!edge) continue;
    if ((state === 'sealed') !== thin) continue;
    rings.push(<Path key={t.id} d={t.d} stroke={colors[edge]} />);
  }

  return rings.length > 0 ? <>{rings}</> : null;
});

const MapLabel = memo(function MapLabel({
  x,
  y,
  text,
  size,
  halo,
  fill,
  haloColor,
  font,
}: {
  x: number;
  y: number;
  text: string;
  size: number;
  halo: number;
  fill: string;
  haloColor: string;
  font: string;
}) {
  const common = {
    x,
    y,
    fontSize: size,
    textAnchor: 'middle' as const,
    fontFamily: font,
  };

  return (
    <G>
      <SvgText
        {...common}
        fill="none"
        stroke={haloColor}
        strokeWidth={halo}
        strokeLinejoin="round"
        opacity={0.9}
      >
        {text}
      </SvgText>
      <SvgText {...common} fill={fill}>
        {text}
      </SvgText>
    </G>
  );
});
