import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  geoConicConformal,
  geoGraticule,
  geoGraticule10,
  geoMercator,
  geoNaturalEarth1,
  geoPath,
} from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';

import {
  POPULATION_EXEMPT,
  REGION_FR,
  SUBREGION_FR,
  translateRegion,
  UN_MEMBERSHIP_OVERRIDES,
} from './lib/corrections.mts';
import { fetchJson, mapLimit } from './lib/fetch-cache.mts';
import { decodePath } from '../src/map/geometry.ts';
import {
  dissolveRings,
  encodeRelativePath,
  mainRingsOf,
  poleOfInaccessibility,
  simplifyPreservingTopology,
} from './lib/geo-utils.mts';
import type {
  BBox,
  Country,
  Department,
  FranceAtlas,
  Inset,
  Point,
  WorldAtlas,
} from '../src/data/types.ts';

const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data');

const flatToRing = (flat: Float64Array): [number, number][] => {
  const ring: [number, number][] = [];
  for (let i = 0; i < flat.length; i += 2) ring.push([flat[i]!, flat[i + 1]!]);
  return ring;
};

const SRC = {
  departments:
    'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-avec-outre-mer.geojson',
  departmentMeta: 'https://geo.api.gouv.fr/departements?fields=nom,code,codeRegion,chefLieu',
  regions: 'https://geo.api.gouv.fr/regions',
  commune: (insee: string) =>
    `https://geo.api.gouv.fr/communes/${insee}?fields=nom,code,centre,population`,
  countries:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
  countryMeta: 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json',
  population:
    'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400',
};

const ATTRIBUTION = {
  france:
    'Contours : france-geojson (Grégoire David), d’après l’IGN ADMIN-EXPRESS — licence ouverte. Chefs-lieux et régions : API Découpage administratif (Etalab).',
  world:
    'Contours : Natural Earth (domaine public). Métadonnées : mledoze/countries (ODbL). Populations : Banque mondiale (SP.POP.TOTL, CC BY 4.0).',
};

const ATLAS_WIDTH = 4000;
const PAD = 80;
const INSET_ROW_HEIGHT = 600;
const INSET_GAP = 40;
const INSET_PAD = 48;

const TOLERANCE = {
  france: Number(process.env.TOL_FR ?? 3e-5),
  world: Number(process.env.TOL_WORLD ?? 8e-4),
};

type AnyFeature<P> = Feature<Geometry, P>;

const path = (projection: GeoProjection) => geoPath(projection);

function fitInto(projection: GeoProjection, frame: BBox, object: object): void {
  const [x0, y0, x1, y1] = frame;
  projection.fitExtent(
    [
      [x0, y0],
      [x1, y1],
    ],
    object as never,
  );
}

function bboxOf(projection: GeoProjection, f: AnyFeature<unknown>): BBox {
  const [[x0, y0], [x1, y1]] = path(projection).bounds(f as never);
  return [round(x0), round(y0), round(x1), round(y1)];
}

const round = (n: number): number => Math.round(n);

function labelAnchor(projection: GeoProjection, geometry: Geometry): Point {
  const rings = mainRingsOf(geometry);
  if (rings.length === 0) return [0, 0];

  const projectedRings = rings.map((ring) =>
    ring
      .map((p) => projection([p[0] as number, p[1] as number]))
      .filter((p): p is [number, number] => p !== null),
  );
  if (projectedRings[0]?.length === 0) return [0, 0];

  const [x, y] = poleOfInaccessibility(projectedRings);
  return [round(x), round(y)];
}

function projectedArea(projection: GeoProjection, f: AnyFeature<unknown>): number {
  return round(path(projection).area(f as never));
}

const isPolygonal = (g: Geometry | null): g is Polygon | MultiPolygon =>
  g?.type === 'Polygon' || g?.type === 'MultiPolygon';

type DeptProps = { code: string; nom: string };
type DeptMeta = { nom: string; code: string; codeRegion: string; chefLieu: string };
type RegionMeta = { nom: string; code: string };
type CommuneMeta = {
  nom: string;
  code: string;
  centre: { coordinates: [number, number] };
  population?: number;
};

const OVERSEAS_ORDER = ['971', '972', '973', '974', '976'] as const;

async function buildFrance(): Promise<FranceAtlas> {
  console.log('\n▸ Atlas France');

  const source = await fetchJson<FeatureCollection<Geometry, DeptProps>>(
    SRC.departments,
    'fr-departements.geojson',
  );
  const meta = await fetchJson<DeptMeta[]>(SRC.departmentMeta, 'fr-departements-meta.json');
  const regions = await fetchJson<RegionMeta[]>(SRC.regions, 'fr-regions.json');

  const metaByCode = new Map(meta.map((m) => [m.code, m]));
  const regionByCode = new Map(regions.map((r) => [r.code, r.nom]));

  console.log(`  · ${source.features.length} départements, ${regions.length} régions`);

  const communes = await mapLimit(meta, 6, (m) =>
    fetchJson<CommuneMeta>(SRC.commune(m.chefLieu), `fr-commune-${m.chefLieu}.json`),
  );
  const prefectureByDept = new Map(meta.map((m, i) => [m.code, communes[i]!]));
  console.log(`  · ${communes.length} chefs-lieux résolus`);

  const { features, neighborIndices } = simplifyPreservingTopology(
    source.features,
    TOLERANCE.france,
  );
  const codes = features.map((f) => f.properties.code);
  const neighborsByIndex = neighborIndices.map((list) =>
    list.map((i) => codes[i]!).filter(Boolean).sort(),
  );

  const overseas = new Set<string>(OVERSEAS_ORDER);
  const metroFeatures = features.filter((f) => !overseas.has(f.properties.code));
  const metroCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: metroFeatures as Feature[],
  };

  const metro = geoConicConformal().parallels([44, 49]).rotate([-3, 0]);
  const mainFrame: BBox = [PAD, PAD, ATLAS_WIDTH - PAD, ATLAS_WIDTH - PAD];
  fitInto(metro, mainFrame, metroCollection);

  const [[mx0, my0], [mx1, my1]] = path(metro).bounds(metroCollection as never);
  const mainHeight = my1 - my0 + PAD * 2;
  metro.translate([
    metro.translate()[0] - mx0 + PAD + (ATLAS_WIDTH - PAD * 2 - (mx1 - mx0)) / 2,
    metro.translate()[1] - my0 + PAD,
  ]);
  const tightMainFrame: BBox = [0, 0, ATLAS_WIDTH, round(mainHeight)];

  const insetTop = mainHeight;
  const slotWidth =
    (ATLAS_WIDTH - PAD * 2 - INSET_GAP * (OVERSEAS_ORDER.length - 1)) / OVERSEAS_ORDER.length;

  const insets: Inset[] = OVERSEAS_ORDER.map((code, i) => ({
    id: code,
    label: metaByCode.get(code)?.nom ?? code,
    frame: [
      round(PAD + i * (slotWidth + INSET_GAP)),
      round(insetTop),
      round(PAD + i * (slotWidth + INSET_GAP) + slotWidth),
      round(insetTop + INSET_ROW_HEIGHT),
    ],
  }));
  const insetById = new Map(insets.map((s) => [s.id, s]));

  const atlasHeight = round(insetTop + INSET_ROW_HEIGHT + PAD);

  const projectionFor = (code: string): GeoProjection => {
    const inset = insetById.get(code);
    if (!inset) return metro;
    const f = features.find((x) => x.properties.code === code)!;
    const p = geoMercator();
    const [x0, y0, x1, y1] = inset.frame;
    fitInto(p, [x0 + INSET_PAD, y0 + INSET_PAD, x1 - INSET_PAD, y1 - INSET_PAD], f);
    return p;
  };

  const territories: Department[] = features
    .map((f, index): Department | null => {
      const code = f.properties.code;
      const m = metaByCode.get(code);
      const commune = prefectureByDept.get(code);
      if (!m || !commune) {
        console.warn(`  ! métadonnées manquantes pour le département ${code}`);
        return null;
      }
      if (!isPolygonal(f.geometry)) return null;

      const projection = projectionFor(code);
      const d = encodeRelativePath(path(projection)(f as never) ?? '');
      const [lon, lat] = commune.centre.coordinates;
      const projected = projection([lon, lat]);

      return {
        id: code,
        name: f.properties.nom,
        d,
        label: labelAnchor(projection, f.geometry),
        bbox: bboxOf(projection, f),
        area: projectedArea(projection, f),
        neighbors: neighborsByIndex[index] ?? [],
        prefecture: commune.nom,
        prefecturePoint: projected ? [round(projected[0]), round(projected[1])] : [0, 0],
        prefecturePopulation: commune.population ?? 0,
        regionId: m.codeRegion,
        region: regionByCode.get(m.codeRegion) ?? '',
        overseas: overseas.has(code),
      };
    })
    .filter((t): t is Department => t !== null)
    .sort((a, b) => a.id.localeCompare(b.id, 'fr', { numeric: true }));

  const outline = encodeRelativePath(path(metro)(metroCollection as never) ?? '');

  const graticule = encodeRelativePath(
    path(metro)(
      geoGraticule()
        .extent([
          [-6, 41],
          [10, 52],
        ])
        .step([2, 2])(),
    ) ?? '',
  );

  console.log(`  · ${territories.length} territoires, atlas ${ATLAS_WIDTH}×${atlasHeight}`);

  return {
    id: 'france-departments',
    name: 'France — départements',
    width: ATLAS_WIDTH,
    height: atlasHeight,
    mainFrame: tightMainFrame,
    insets,
    territories,
    outline,
    graticule,
    attribution: ATTRIBUTION.france,
  };
}

type NeProps = {
  ISO_A3: string;
  ISO_A3_EH: string;
  ADM0_A3: string;
  NAME: string;
  NAME_FR: string;
  CONTINENT: string;
  POP_EST: number;
};

type MledozeCountry = {
  cca2: string;
  cca3: string;
  name: { common: string };
  translations: { fra?: { common: string; official: string } };
  capital?: string[];
  region: string;
  subregion?: string;
  latlng: [number, number];
  flag: string;
  area: number;
  unMember: boolean;
  independent: boolean;
  borders?: string[];
};

type WorldBankRow = { countryiso3code: string; date: string; value: number | null };

function isoOf(p: NeProps): string {
  for (const candidate of [p.ISO_A3, p.ISO_A3_EH, p.ADM0_A3]) {
    if (candidate && candidate !== '-99') return candidate;
  }
  return p.ADM0_A3;
}

async function buildWorld(): Promise<WorldAtlas> {
  console.log('\n▸ Atlas Monde');

  const source = await fetchJson<FeatureCollection<Geometry, NeProps>>(
    SRC.countries,
    'world-countries.geojson',
  );
  const meta = await fetchJson<MledozeCountry[]>(SRC.countryMeta, 'world-meta.json');

  const [, populationRows = []] = await fetchJson<[unknown, WorldBankRow[]]>(
    SRC.population,
    'world-population.json',
  );
  const populationByIso = new Map<string, number>();
  let populationYear = '';
  for (const row of populationRows) {
    if (row.countryiso3code && row.value) {
      populationByIso.set(row.countryiso3code, row.value);
      if (row.date > populationYear) populationYear = row.date;
    }
  }

  console.log(
    `  · ${source.features.length} entités Natural Earth, ${meta.length} fiches pays, ${populationByIso.size} populations (${populationYear})`,
  );

  const { features } = simplifyPreservingTopology(source.features, TOLERANCE.world);

  const world = geoNaturalEarth1();
  const sphere = { type: 'Sphere' } as const;
  fitInto(world, [PAD, PAD, ATLAS_WIDTH - PAD, ATLAS_WIDTH - PAD], sphere);

  const [[wx0, wy0], [wx1, wy1]] = path(world).bounds(sphere as never);
  const worldHeight = round(wy1 - wy0 + PAD * 2);
  world.translate([
    world.translate()[0] - wx0 + PAD,
    world.translate()[1] - wy0 + PAD,
  ]);
  void wx1;

  const geometryByIso = new Map<string, AnyFeature<NeProps>>();
  features.forEach((f) => {
    const iso = isoOf(f.properties);
    if (iso) geometryByIso.set(iso, f);
  });

  const selected = meta.filter((m) => m.unMember || geometryByIso.has(m.cca3));
  const selectedIsos = new Set(selected.map((m) => m.cca3));

  const borderGraph = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    if (a === b || !selectedIsos.has(a) || !selectedIsos.has(b)) return;
    if (!borderGraph.has(a)) borderGraph.set(a, new Set());
    borderGraph.get(a)!.add(b);
  };
  for (const m of selected) {
    for (const other of m.borders ?? []) {
      link(m.cca3, other);
      link(other, m.cca3);
    }
  }
  const bordersOf = (iso: string): string[] => [...(borderGraph.get(iso) ?? [])].sort();

  const territories: Country[] = selected
    .map((m): Country => {
      const f = geometryByIso.get(m.cca3);
      const name = m.translations.fra?.common ?? m.name.common;
      const population = populationByIso.get(m.cca3) ?? 0;
      const unMember = UN_MEMBERSHIP_OVERRIDES[m.cca3] ?? m.unMember;

      if (!f || !isPolygonal(f.geometry)) {
        const projected = world([m.latlng[1], m.latlng[0]]);
        const label: Point = projected ? [round(projected[0]), round(projected[1])] : [0, 0];
        return {
          id: m.cca3,
          name,
          d: '',
          label,
          bbox: [label[0], label[1], label[0], label[1]],
          area: 0,
          neighbors: bordersOf(m.cca3),
          cca2: m.cca2,
          capital: m.capital?.[0] ?? '',
          flag: m.flag,
          region: translateRegion(REGION_FR, m.region),
          subregion: translateRegion(SUBREGION_FR, m.subregion ?? m.region),
          population,
          areaKm2: m.area,
          unMember,
        };
      }

      return {
        id: m.cca3,
        name,
        d: encodeRelativePath(path(world)(f as never) ?? ''),
        label: labelAnchor(world, f.geometry),
        bbox: bboxOf(world, f),
        area: projectedArea(world, f),
        neighbors: bordersOf(m.cca3),
        cca2: m.cca2,
        capital: m.capital?.[0] ?? '',
        flag: m.flag,
        region: translateRegion(REGION_FR, m.region),
        subregion: translateRegion(SUBREGION_FR, m.subregion ?? m.region),
        population,
        areaKm2: m.area,
        unMember,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const missingPopulation = territories
    .filter((t) => t.population === 0 && !POPULATION_EXEMPT.has(t.id))
    .map((t) => t.id);
  if (missingPopulation.length > 0) {
    console.warn(`  ! population absente pour : ${missingPopulation.join(', ')}`);
  }

  const withGeometry = territories.filter((t) => t.d !== '').length;
  console.log(
    `  · ${territories.length} pays retenus (${withGeometry} avec contour, ${territories.length - withGeometry} repérés par un point)`,
  );

  return {
    id: 'world-countries',
    name: 'Monde — pays',
    width: ATLAS_WIDTH,
    height: worldHeight,
    mainFrame: [0, 0, ATLAS_WIDTH, worldHeight],
    insets: [],
    territories,
    outline: dissolveRings(
      territories.flatMap((t) => (t.d ? decodePath(t.d).map(flatToRing) : [])),
    ),
    frame: encodeRelativePath(path(world)(sphere as never) ?? ''),
    graticule: encodeRelativePath(path(world)(geoGraticule10()) ?? ''),
    attribution: ATTRIBUTION.world,
  };
}

function emit(name: string, data: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, name);
  const json = JSON.stringify(data);
  writeFileSync(file, json);
  console.log(`  ✓ ${name} — ${(json.length / 1024).toFixed(0)} Ko`);
}

async function main(): Promise<void> {
  console.log('Construction des atlas Portulan');
  const france = await buildFrance();
  const world = await buildWorld();

  console.log('\n▸ Écriture');
  emit('france-departments.json', france);
  emit('world-countries.json', world);
  console.log('\nTerminé.\n');
}

await main();
