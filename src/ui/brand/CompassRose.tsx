import { useMemo } from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import { rhumbLines, roseBranches, roseTicks } from './rose-geometry';

export type CompassRoseProps = {
  size: number;
  /** Nombre de pointes. Seize pour le décor, huit dès que la rose est petite. */
  points?: 8 | 16;
  /** Couronne graduée et cercles concentriques. */
  dial?: boolean;
  /** Trame de rhumbs rayonnante. */
  rhumbs?: boolean;
  opacity?: number;
};

/**
 * La rose des vents de Portulan.
 *
 * Sa géométrie vient du même module que celui qui génère l'icône du magasin :
 * une rose dessinée deux fois finirait par diverger, et la marque de l'écran
 * d'accueil ne ressemblerait plus à celle de la grille d'applications.
 */
export function CompassRose({
  size,
  points = 16,
  dial = true,
  rhumbs = true,
  opacity = 1,
}: CompassRoseProps) {
  const theme = useTheme();
  const r = size / 2;

  const { branches, ticks, rhumbPath } = useMemo(
    () => ({
      branches: roseBranches(points, { cx: r, cy: r, radius: r * 0.82, hub: 0.3 }),
      ticks: roseTicks({ cx: r, cy: r, radius: r * 0.95, long: r * 0.06, short: r * 0.032 }),
      rhumbPath: rhumbLines(r, r, r * 0.9, 32),
    }),
    [points, r],
  );

  const stroke = Math.max(0.5, size / 340);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} opacity={opacity}>
      {rhumbs ? (
        <Path
          d={rhumbPath}
          stroke={theme.colors.mapRhumb}
          strokeWidth={stroke * 0.8}
          fill="none"
          opacity={0.5}
        />
      ) : null}

      {dial ? (
        <G>
          <Circle
            cx={r}
            cy={r}
            r={r * 0.95}
            fill="none"
            stroke={theme.colors.border}
            strokeWidth={stroke * 1.8}
          />
          <Circle
            cx={r}
            cy={r}
            r={r * 0.87}
            fill="none"
            stroke={theme.colors.border}
            strokeWidth={stroke * 0.8}
            opacity={0.7}
          />
          {ticks.map((tick, i) => (
            <Path
              key={i}
              d={tick.d}
              stroke={theme.colors.textTertiary}
              strokeWidth={tick.major ? stroke * 2 : stroke}
              opacity={tick.major ? 0.7 : 0.4}
              strokeLinecap="round"
            />
          ))}
        </G>
      ) : null}

      {/* Rangs inférieurs d'abord : les cardinales doivent passer devant. */}
      {[...branches]
        .sort((a, b) => b.rank - a.rank)
        .map((branch, i) => {
          /* Seul le nord est en vermillon : colorer les quatre cardinales
             ferait un moulin à vent, n'en marquer qu'une oriente la rose. */
          const isNorth = branch.angle === 0;
          return (
            <G key={i}>
              <Path
                d={branch.dark}
                fill={isNorth ? theme.colors.dangerStrong : theme.colors.text}
                stroke={theme.colors.text}
                strokeWidth={stroke}
                strokeLinejoin="round"
              />
              <Path
                d={branch.light}
                fill={isNorth ? theme.colors.danger : theme.colors.surfaceRaised}
                stroke={theme.colors.text}
                strokeWidth={stroke * 1.4}
                strokeLinejoin="round"
              />
            </G>
          );
        })}

      <Circle
        cx={r}
        cy={r}
        r={r * 0.062}
        fill={theme.colors.reward}
        stroke={theme.colors.text}
        strokeWidth={stroke * 1.4}
      />
      <Circle cx={r} cy={r} r={r * 0.022} fill={theme.colors.text} />
    </Svg>
  );
}
