/**
 * Types des jeux de données géographiques.
 *
 * Toutes les géométries sont **pré-projetées à la compilation** dans un espace
 * de coordonnées « atlas » (un viewBox SVG fixe). Le runtime ne fait donc
 * aucune reprojection : il applique une simple matrice pan/zoom sur un groupe
 * SVG. Aucune dépendance d3 n'est embarquée dans l'application.
 */

/** Rectangle englobant en coordonnées atlas : [x0, y0, x1, y1]. */
export type BBox = [number, number, number, number];

/** Point en coordonnées atlas. */
export type Point = [number, number];

export type Territory = {
  /** Identifiant stable et lisible : code de département (« 01 ») ou ISO 3166-1 alpha-3 (« FRA »). */
  id: string;
  name: string;
  /** Tracé SVG dans l'espace atlas. */
  d: string;
  /** Ancre d'étiquette : pôle d'inaccessibilité approché, pas le centroïde brut. */
  label: Point;
  bbox: BBox;
  /** Aire projetée en unités atlas² — sert à calibrer la difficulté et l'épaisseur du trait. */
  area: number;
  /** Identifiants des territoires limitrophes, pour les leurres plausibles et les questions de voisinage. */
  neighbors: string[];
};

export type Department = Territory & {
  /** Chef-lieu du département. */
  prefecture: string;
  /** Position du chef-lieu en coordonnées atlas. */
  prefecturePoint: Point;
  prefecturePopulation: number;
  regionId: string;
  region: string;
  /** Vrai pour les départements d'outre-mer, rendus dans un cartouche. */
  overseas: boolean;
};

export type Country = Territory & {
  /** ISO 3166-1 alpha-2. */
  cca2: string;
  capital: string;
  /** Emoji drapeau. */
  flag: string;
  region: string;
  subregion: string;
  population: number;
  /** Superficie réelle en km² (et non l'aire projetée). */
  areaKm2: number;
  unMember: boolean;
};

/** Cartouche : sous-cadre du viewBox accueillant un territoire éloigné. */
export type Inset = {
  id: string;
  label: string;
  frame: BBox;
};

export type Atlas<T extends Territory> = {
  id: string;
  name: string;
  /** Dimensions du viewBox de l'atlas. */
  width: number;
  height: number;
  /** Cadre du corps principal de la carte, hors cartouches. */
  mainFrame: BBox;
  insets: Inset[];
  territories: T[];
  /** Silhouette d'ensemble — utile pour l'ombre portée et le halo côtier. */
  outline: string;
  /** Graticule (parallèles et méridiens) déjà projeté. */
  graticule: string;
  /** Note de provenance des données, affichée dans les crédits de l'application. */
  attribution: string;
};

export type FranceAtlas = Atlas<Department>;
export type WorldAtlas = Atlas<Country>;
