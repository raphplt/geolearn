import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Atlas, BBox, Territory } from '@/data/types';
import { useTheme } from '@/theme';
import { buildHitIndex, hitTest } from './geometry';

/** État visuel d'un territoire pendant une question. */
export type TerritoryState =
  /** Au repos : dessiné, mais en retrait. */
  | 'idle'
  /** Mis en évidence — c'est le sujet de la question. */
  | 'target'
  /** Réponse juste. */
  | 'correct'
  /** Réponse fausse choisie par le joueur. */
  | 'wrong'
  /** Bonne réponse révélée après une erreur. */
  | 'reveal'
  /** Déjà acquis dans l'atlas de maîtrise. */
  | 'mastered';

export type AtlasMapProps = {
  /**
   * Atlas à peindre.
   *
   * Typé sur `Territory` et non sur un paramètre générique : le rendu n'utilise
   * que les champs communs (tracé, emprise, ancre), et rester générique forçait
   * l'inférence à choisir `Department` ou `Country` là où l'appelant passe une
   * union des deux.
   */
  atlas: Atlas<Territory>;
  /** États par identifiant de territoire. Les absents sont `idle`. */
  states?: Readonly<Record<string, TerritoryState>>;
  onSelect?: (territoryId: string) => void;
  /** Cadre affiché. Par défaut, l'atlas entier. */
  viewBox?: BBox;
  /** Étiquette les territoires dont l'aire dépasse ce seuil. `0` pour n'en afficher aucune. */
  labelThreshold?: number;
  /** Désactive le pointé — pour un usage purement décoratif. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Marge de rattrapage du toucher, en unités atlas.
 *
 * Un doigt couvre environ 8 mm, soit plusieurs centaines d'unités atlas sur un
 * téléphone. Sans rattrapage, le Territoire de Belfort, le Val-de-Marne ou le
 * Luxembourg seraient tout simplement impossibles à désigner. Le pointé teste
 * d'abord l'appartenance exacte : ce rattrapage ne s'applique que si le toucher
 * ne tombe dans aucun territoire, il ne vole donc jamais un toucher franc.
 */
const TOUCH_TOLERANCE = 90;

/** Une aire de territoire en deçà de laquelle une étiquette ne tiendrait pas. */
const DEFAULT_LABEL_THRESHOLD = 26_000;

export function AtlasMap({
  atlas,
  states,
  onSelect,
  viewBox,
  labelThreshold = DEFAULT_LABEL_THRESHOLD,
  interactive = true,
  style,
}: AtlasMapProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const index = useMemo(() => buildHitIndex(atlas), [atlas]);

  const frame: BBox = viewBox ?? [0, 0, atlas.width, atlas.height];
  const frameWidth = frame[2] - frame[0];
  const frameHeight = frame[3] - frame[1];

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  /*
   * Conversion écran → atlas.
   *
   * `preserveAspectRatio="xMidYMid meet"` cadre le viewBox en le centrant sur
   * la plus petite échelle : on refait ici exactement le même calcul pour
   * repasser des coordonnées du toucher à celles de l'atlas. Toute divergence
   * entre les deux se traduirait par un décalage constant entre l'endroit
   * touché et le territoire désigné — le genre de défaut qu'on attribue à tort
   * à la géométrie.
   */
  const toAtlas = useCallback(
    (x: number, y: number): [number, number] | null => {
      if (size.width === 0 || size.height === 0) return null;
      const scale = Math.min(size.width / frameWidth, size.height / frameHeight);
      const offsetX = (size.width - frameWidth * scale) / 2;
      const offsetY = (size.height - frameHeight * scale) / 2;
      return [frame[0] + (x - offsetX) / scale, frame[1] + (y - offsetY) / scale];
    },
    [size.width, size.height, frame, frameWidth, frameHeight],
  );

  /* Le rattrapage doit valoir la même distance *perçue* quel que soit le zoom :
     exprimé en unités atlas, il rétrécirait à mesure qu'on cadre serré. */
  const toleranceRef = useRef(TOUCH_TOLERANCE);
  toleranceRef.current = TOUCH_TOLERANCE * (frameWidth / atlas.width);

  const handlePress = useCallback(
    (x: number, y: number) => {
      if (!onSelect) return;
      const point = toAtlas(x, y);
      if (!point) return;
      const hit = hitTest(index, point[0], point[1], { tolerance: toleranceRef.current });
      if (hit) onSelect(hit);
    },
    [index, onSelect, toAtlas],
  );

  const labelled = useMemo(
    () =>
      labelThreshold <= 0
        ? []
        : atlas.territories.filter((t) => t.d !== '' && t.area >= labelThreshold),
    [atlas.territories, labelThreshold],
  );

  const content = (
    <Svg
      width="100%"
      height="100%"
      viewBox={`${frame[0]} ${frame[1]} ${frameWidth} ${frameHeight}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Halo côtier : la silhouette d'ensemble, tracée deux fois de plus en
          plus large et de plus en plus pâle. C'est le dégradé de bleus que les
          cartes anciennes peignent au large des côtes. */}
      {atlas.outline ? (
        <G>
          <Path
            d={atlas.outline}
            fill="none"
            stroke={theme.colors.mapWaterDeep}
            strokeWidth={52}
            strokeLinejoin="round"
            opacity={0.32}
          />
          <Path
            d={atlas.outline}
            fill="none"
            stroke={theme.colors.mapWater}
            strokeWidth={22}
            strokeLinejoin="round"
            opacity={0.75}
          />
        </G>
      ) : null}

      {atlas.graticule ? (
        <Path
          d={atlas.graticule}
          fill="none"
          stroke={theme.colors.mapGraticule}
          strokeWidth={2}
          opacity={0.45}
        />
      ) : null}

      {/* Cartouches d'outre-mer, sous les territoires qu'ils encadrent. */}
      {atlas.insets.map((inset) => (
        <G key={inset.id}>
          <Rect
            x={inset.frame[0]}
            y={inset.frame[1]}
            width={inset.frame[2] - inset.frame[0]}
            height={inset.frame[3] - inset.frame[1]}
            fill={theme.colors.surfaceRaised}
            stroke={theme.colors.border}
            strokeWidth={3}
            rx={12}
          />
          <SvgText
            x={inset.frame[0] + 16}
            y={inset.frame[3] - 18}
            fontSize={34}
            fill={theme.colors.textTertiary}
            fontFamily={theme.fontFamily.body}
          >
            {inset.label}
          </SvgText>
        </G>
      ))}

      {atlas.territories.map((t) =>
        t.d ? (
          <TerritoryShape key={t.id} d={t.d} state={states?.[t.id] ?? 'idle'} />
        ) : null,
      )}

      {/* Les territoires mis en avant sont retracés par-dessus : sans cela, le
          contour d'un voisin dessiné après eux viendrait mordre leur bordure. */}
      {atlas.territories.map((t) => {
        const state = states?.[t.id] ?? 'idle';
        if (!t.d || state === 'idle' || state === 'mastered') return null;
        return <TerritoryOutline key={`${t.id}-top`} d={t.d} state={state} />;
      })}

      {labelled.map((t) => (
        <SvgText
          key={`${t.id}-label`}
          x={t.label[0]}
          y={t.label[1]}
          fontSize={30}
          textAnchor="middle"
          fill={theme.colors.textSecondary}
          fontFamily={theme.fontFamily.body}
          opacity={0.75}
        >
          {t.name}
        </SvgText>
      ))}
    </Svg>
  );

  return (
    <View style={style} onLayout={onLayout}>
      {interactive && onSelect ? (
        <Pressable
          style={{ flex: 1 }}
          onPress={(event) =>
            handlePress(event.nativeEvent.locationX, event.nativeEvent.locationY)
          }
          accessibilityRole="adjustable"
          accessibilityLabel={`Carte : ${atlas.name}`}
          accessibilityHint="Touchez un territoire pour le désigner"
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </View>
  );
}

/* ───────────────────── Formes ───────────────────── */

/**
 * Un territoire.
 *
 * Mémoïsé sur son seul état : sans cela, répondre à une question redessinerait
 * les 101 départements alors qu'un seul a changé d'apparence.
 */
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
          : state === 'mastered'
            ? theme.colors.mapLand
            : theme.colors.mapLandIdle;

  return (
    <Path
      d={d}
      fill={fill}
      stroke={theme.colors.mapStroke}
      strokeWidth={2.5}
      strokeLinejoin="round"
    />
  );
});

const TerritoryOutline = memo(function TerritoryOutline({
  d,
  state,
}: {
  d: string;
  state: TerritoryState;
}) {
  const theme = useTheme();
  const stroke =
    state === 'correct'
      ? theme.colors.success
      : state === 'wrong'
        ? theme.colors.danger
        : theme.colors.reward;

  return (
    <Path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={9}
      strokeLinejoin="round"
      opacity={0.95}
    />
  );
});
