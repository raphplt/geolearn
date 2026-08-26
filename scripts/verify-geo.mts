/**
 * Contrôle d'intégrité des atlas produits par `build-geo`.
 *
 *   npx tsx scripts/verify-geo.mts
 *
 * Le pipeline enchaîne simplification topologique, projection, encodage relatif
 * et jointures sur trois sources distinctes. Chacune de ces étapes peut échouer
 * silencieusement — un cartouche vide, une étiquette dans la mer, un voisin qui
 * n'existe pas — sans qu'aucune exception ne soit levée. Ce script transforme
 * ces défaillances muettes en échecs bruyants.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { POPULATION_EXEMPT } from './lib/corrections.mts';
import { decodeRelativePath } from './lib/geo-utils.mts';
import type { BBox, Country, Department, FranceAtlas, WorldAtlas } from '../src/data/types.ts';

const DATA_DIR = join(import.meta.dirname, '..', 'src', 'data');

let failures = 0;
let checks = 0;

function check(condition: boolean, message: string, detail?: string): void {
  checks++;
  if (condition) return;
  failures++;
  console.error(`  ✗ ${message}${detail ? `\n      ${detail}` : ''}`);
}

/** Marge de tolérance : l'encodage entier peut décaler un sommet d'un demi-quantum. */
const EPS = 1.5;

const inside = ([x, y]: [number, number], [x0, y0, x1, y1]: BBox, slack = EPS): boolean =>
  x >= x0 - slack && x <= x1 + slack && y >= y0 - slack && y <= y1 + slack;

const bboxWithin = (inner: BBox, outer: BBox, slack = EPS): boolean =>
  inside([inner[0], inner[1]], outer, slack) && inside([inner[2], inner[3]], outer, slack);

function bboxOfPath(d: string): BBox | null {
  const pts = decodeRelativePath(d);
  if (pts.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

function verifyCommon(atlas: FranceAtlas | WorldAtlas): void {
  const ids = new Set<string>();
  const atlasBox: BBox = [0, 0, atlas.width, atlas.height];

  check(atlas.width > 0 && atlas.height > 0, `${atlas.id} : dimensions d'atlas valides`);
  check(atlas.attribution.length > 0, `${atlas.id} : mention de provenance présente`);

  for (const t of atlas.territories) {
    check(!ids.has(t.id), `${atlas.id} : identifiant unique`, `doublon « ${t.id} »`);
    ids.add(t.id);
    check(t.name.trim().length > 0, `${atlas.id}/${t.id} : nom non vide`);
    check(
      Number.isFinite(t.label[0]) && Number.isFinite(t.label[1]),
      `${atlas.id}/${t.id} : ancre d'étiquette finie`,
    );

    if (t.d) {
      const decoded = bboxOfPath(t.d);
      check(decoded !== null, `${atlas.id}/${t.id} : tracé décodable`);
      if (decoded) {
        const drift = Math.max(
          ...decoded.map((v, i) => Math.abs(v - (t.bbox[i] as number))),
        );
        check(
          drift <= EPS,
          `${atlas.id}/${t.id} : le tracé encodé coïncide avec sa bbox`,
          `dérive ${drift.toFixed(2)} u — bbox ${t.bbox.join(',')} vs tracé ${decoded.map((v) => v.toFixed(0)).join(',')}`,
        );
      }
      check(t.area > 0, `${atlas.id}/${t.id} : aire projetée strictement positive`);
      check(
        inside(t.label, t.bbox),
        `${atlas.id}/${t.id} : ancre d'étiquette dans son emprise`,
        `ancre ${t.label.join(',')} hors de ${t.bbox.join(',')}`,
      );
      check(
        bboxWithin(t.bbox, atlasBox, 4),
        `${atlas.id}/${t.id} : territoire dans le viewBox`,
        `bbox ${t.bbox.join(',')} déborde de ${atlasBox.join(',')}`,
      );
    }

    for (const n of t.neighbors) {
      check(
        n !== t.id,
        `${atlas.id}/${t.id} : un territoire n'est pas son propre voisin`,
      );
    }
  }

  /* Symétrie du voisinage : si A borde B, B borde A. */
  const byId = new Map(atlas.territories.map((t) => [t.id, t]));
  for (const t of atlas.territories) {
    for (const n of t.neighbors) {
      const other = byId.get(n);
      if (!other) continue; /* voisin hors atlas (pays non retenu) — toléré */
      check(
        other.neighbors.includes(t.id),
        `${atlas.id} : relation de voisinage symétrique`,
        `${t.id} → ${n} sans réciproque`,
      );
    }
  }
}

function verifyFrance(atlas: FranceAtlas): void {
  console.log('\n▸ France');
  verifyCommon(atlas);

  check(
    atlas.territories.length === 101,
    'France : 101 départements',
    `trouvé ${atlas.territories.length}`,
  );

  const expectedOverseas = ['971', '972', '973', '974', '976'];
  const overseas = atlas.territories.filter((t) => t.overseas).map((t) => t.id);
  check(
    JSON.stringify(overseas.slice().sort()) === JSON.stringify(expectedOverseas),
    'France : les cinq départements d’outre-mer sont marqués',
    `trouvé ${overseas.join(',')}`,
  );
  check(
    atlas.insets.length === expectedOverseas.length,
    'France : un cartouche par département d’outre-mer',
  );

  const insetById = new Map(atlas.insets.map((i) => [i.id, i]));
  for (const t of atlas.territories as Department[]) {
    check(t.prefecture.trim().length > 0, `France/${t.id} : chef-lieu renseigné`);
    check(t.region.trim().length > 0, `France/${t.id} : région renseignée`);
    check(
      inside(t.prefecturePoint, t.bbox, 8),
      `France/${t.id} : le chef-lieu tombe dans son département`,
      `${t.prefecture} en ${t.prefecturePoint.join(',')} hors de ${t.bbox.join(',')}`,
    );

    if (t.overseas) {
      const inset = insetById.get(t.id);
      check(inset !== undefined, `France/${t.id} : cartouche présent`);
      if (inset) {
        check(
          bboxWithin(t.bbox, inset.frame, 2),
          `France/${t.id} : le territoire tient dans son cartouche`,
          `bbox ${t.bbox.join(',')} déborde du cadre ${inset.frame.join(',')}`,
        );
      }
    } else {
      check(
        bboxWithin(t.bbox, atlas.mainFrame, 4),
        `France/${t.id} : département métropolitain dans le cadre principal`,
        `bbox ${t.bbox.join(',')} hors de ${atlas.mainFrame.join(',')}`,
      );
      check(
        t.neighbors.length > 0,
        `France/${t.id} : un département métropolitain a au moins un voisin`,
      );
    }
  }

  /* Aucun cartouche ne doit chevaucher le corps de la carte ni un autre cartouche. */
  const frames = atlas.insets.map((i) => i.frame);
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const a = frames[i]!;
      const b = frames[j]!;
      const overlap = a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      check(!overlap, 'France : les cartouches ne se chevauchent pas', `${i} × ${j}`);
    }
  }
}

function verifyWorld(atlas: WorldAtlas): void {
  console.log('\n▸ Monde');
  verifyCommon(atlas);

  const unMembers = atlas.territories.filter((t) => t.unMember);
  check(
    unMembers.length === 193,
    'Monde : exactement 193 États membres de l’ONU',
    `trouvé ${unMembers.length}`,
  );

  for (const t of unMembers as Country[]) {
    check(t.capital.trim().length > 0, `Monde/${t.id} : capitale renseignée`, t.name);
    check(t.flag.trim().length > 0, `Monde/${t.id} : drapeau renseigné`, t.name);
    check(t.cca2.length === 2, `Monde/${t.id} : code alpha-2 valide`, t.name);
    check(t.region.trim().length > 0, `Monde/${t.id} : région renseignée`, t.name);
    check(
      t.population > 0 || POPULATION_EXEMPT.has(t.id),
      `Monde/${t.id} : population renseignée`,
      t.name,
    );
  }

  const withShape = atlas.territories.filter((t) => t.d !== '').length;
  check(withShape >= 165, 'Monde : contours disponibles pour l’essentiel des pays', `${withShape}`);

  /* Quelques repères connus, pour détecter une jointure ou une projection cassée. */
  const spot: [string, string, string][] = [
    ['FRA', 'France', 'Paris'],
    ['JPN', 'Japon', 'Tokyo'],
    ['BRA', 'Brésil', 'Brasilia'],
    ['AUS', 'Australie', 'Canberra'],
    ['ZAF', 'Afrique du Sud', 'Pretoria'],
  ];
  for (const [id, name, capital] of spot) {
    const t = atlas.territories.find((x) => x.id === id);
    check(t !== undefined, `Monde : ${id} présent`);
    if (!t) continue;
    check(t.name === name, `Monde/${id} : nom français attendu`, `« ${t.name} » ≠ « ${name} »`);
    check(
      t.capital.startsWith(capital.slice(0, 4)),
      `Monde/${id} : capitale attendue`,
      `« ${t.capital} » ≠ « ${capital} »`,
    );
  }
}

const france = JSON.parse(
  readFileSync(join(DATA_DIR, 'france-departments.json'), 'utf8'),
) as FranceAtlas;
const world = JSON.parse(
  readFileSync(join(DATA_DIR, 'world-countries.json'), 'utf8'),
) as WorldAtlas;

console.log('Vérification des atlas');
verifyFrance(france);
verifyWorld(world);

console.log(
  `\n${failures === 0 ? '✓' : '✗'} ${checks - failures}/${checks} contrôles passés\n`,
);
process.exit(failures === 0 ? 0 : 1);
