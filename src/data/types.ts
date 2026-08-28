
export type BBox = [number, number, number, number];

export type Point = [number, number];

export type Territory = {
  id: string;
  name: string;
  d: string;
  label: Point;
  bbox: BBox;
  area: number;
  neighbors: string[];
};

export type Department = Territory & {
  prefecture: string;
  prefecturePoint: Point;
  prefecturePopulation: number;
  regionId: string;
  region: string;
  overseas: boolean;
};

export type Country = Territory & {
  cca2: string;
  capital: string;
  flag: string;
  region: string;
  subregion: string;
  population: number;
  areaKm2: number;
  unMember: boolean;
};

export type Inset = {
  id: string;
  label: string;
  frame: BBox;
};

export type Atlas<T extends Territory> = {
  id: string;
  name: string;
  width: number;
  height: number;
  mainFrame: BBox;
  insets: Inset[];
  territories: T[];
  outline: string;
  frame?: string;
  graticule: string;
  attribution: string;
};

export type FranceAtlas = Atlas<Department>;
export type WorldAtlas = Atlas<Country>;
