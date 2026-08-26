/**
 * Géométrie de la rose des vents — la marque de Portulan.
 *
 * Définie ici comme données pures, sans dépendance au rendu, parce qu'elle a
 * deux consommateurs : le composant SVG de l'application et le script de
 * génération des icônes. Une rose dessinée deux fois finirait par diverger, et
 * l'icône du magasin ne ressemblerait plus à celle de l'écran d'accueil.
 *
 * Construction canonique des cartes-portulans : chaque branche est un losange
 * allongé dont les deux **bases reposent sur les bissectrices** séparant la
 * branche de ses voisines. C'est ce qui fait que les branches se referment
 * exactement les unes sur les autres et dessinent une étoile continue plutôt
 * qu'un bouquet d'aiguilles indépendantes. Chaque losange est ensuite fendu
 * dans sa longueur : la moitié claire et la moitié sombre, toujours du même
 * côté, donnent l'illusion d'un relief éclairé d'une seule source.
 */

export type RoseBranch = {
  /** Moitié éclairée du losange (côté antihoraire de l'axe). */
  light: string;
  /** Moitié dans l'ombre (côté horaire). */
  dark: string;
  /** Angle de la pointe en radians, mesuré depuis le nord, sens horaire. */
  angle: number;
  /** Rang de la branche : 0 = cardinale, 1 = intercardinale, 2 = secondaire. */
  rank: 0 | 1 | 2;
};

export type RoseOptions = {
  cx: number;
  cy: number;
  /** Rayon des pointes cardinales. Les autres rangs en sont déduits. */
  radius: number;
  /**
   * Rayon du moyeu, en fraction de `radius` : la distance à laquelle les bases
   * des branches se rejoignent. C'est lui qui règle l'épaisseur de l'étoile —
   * trop petit elle devient filiforme, trop grand elle s'empâte.
   */
  hub?: number;
  /** Longueur des rangs inférieurs, en fraction de `radius`. */
  falloff?: readonly [number, number];
};

const TAU = Math.PI * 2;
const round = (n: number): number => Math.round(n * 100) / 100;
const p = (x: number, y: number): string => `${round(x)},${round(y)}`;

/** Repère de la carte : 0 = nord, sens horaire. */
const polar = (cx: number, cy: number, angle: number, r: number): [number, number] => {
  const theta = angle - Math.PI / 2;
  return [cx + Math.cos(theta) * r, cy + Math.sin(theta) * r];
};

/**
 * Construit les branches d'une rose à `count` pointes.
 *
 * `count` doit être 8 ou 16 : une rose dont les pointes ne tombent pas sur les
 * quatre points cardinaux n'est plus une rose des vents, et au-delà de 16 les
 * branches secondaires deviennent illisibles à la taille d'une icône.
 */
export function roseBranches(count: 8 | 16, opts: RoseOptions): RoseBranch[] {
  const { cx, cy, radius, hub = 0.16, falloff = [0.62, 0.34] } = opts;

  const step = TAU / count;
  const halfStep = step / 2;
  const hubRadius = radius * hub;
  const branches: RoseBranch[] = [];

  for (let i = 0; i < count; i++) {
    const angle = i * step;

    /* Rang : cardinale tous les quarts de tour, intercardinale sur les
       diagonales, secondaire pour le reste. */
    const rank: 0 | 1 | 2 =
      i % (count / 4) === 0 ? 0 : count === 16 && i % 2 === 0 ? 1 : 2;

    const tipRadius = rank === 0 ? radius : radius * falloff[rank - 1]!;
    /* Les branches secondaires sont aussi plus fines, sinon elles rivalisent
       visuellement avec les cardinales malgré leur longueur moindre. */
    const baseRadius = hubRadius * (rank === 0 ? 1 : rank === 1 ? 0.78 : 0.55);

    const tip = polar(cx, cy, angle, tipRadius);
    const left = polar(cx, cy, angle - halfStep, baseRadius);
    const right = polar(cx, cy, angle + halfStep, baseRadius);

    branches.push({
      angle,
      rank,
      light: `M${p(cx, cy)}L${p(left[0], left[1])}L${p(tip[0], tip[1])}Z`,
      dark: `M${p(cx, cy)}L${p(tip[0], tip[1])}L${p(right[0], right[1])}Z`,
    });
  }

  return branches;
}

/** Graduations de la couronne : un trait long tous les 30°, un court tous les 10°. */
export function roseTicks(opts: {
  cx: number;
  cy: number;
  radius: number;
  long: number;
  short: number;
}): { d: string; major: boolean }[] {
  const { cx, cy, radius, long, short } = opts;
  const ticks: { d: string; major: boolean }[] = [];

  for (let deg = 0; deg < 360; deg += 10) {
    const major = deg % 30 === 0;
    const angle = (deg * Math.PI) / 180;
    const outer = polar(cx, cy, angle, radius);
    const inner = polar(cx, cy, angle, radius - (major ? long : short));
    ticks.push({ d: `M${p(outer[0], outer[1])}L${p(inner[0], inner[1])}`, major });
  }

  return ticks;
}

/**
 * Lignes de rhumb : le motif signature du portulan.
 *
 * Sur une carte marine, ce sont les routes de cap constant tracées depuis les
 * roses. Ici elles servent de trame de fond — elles habillent la surface sans
 * jamais devenir le sujet, d'où leur très faible opacité à l'usage.
 */
export function rhumbLines(cx: number, cy: number, radius: number, count = 32): string {
  const step = TAU / count;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const end = polar(cx, cy, i * step, radius);
    parts.push(`M${p(cx, cy)}L${p(end[0], end[1])}`);
  }
  return parts.join('');
}

/** Libellés des points cardinaux, dans l'ordre des branches d'une rose à 8 ou 16 pointes. */
export const CARDINAL_LABELS = ['N', 'E', 'S', 'O'] as const;
