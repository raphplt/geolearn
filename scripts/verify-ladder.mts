import { FRANCE, WORLD, type AtlasId } from '../src/data/index.ts';
import { difficultyOf, difficultyTable } from '../src/game/difficulty.ts';
import {
  applyAnswer,
  CALIBRATION_LENGTH,
  isDone,
  nextQuestion,
  rungFrom,
  startCalibration,
} from '../src/game/calibration.ts';
import { LADDERS, MAX_RUNG, poolAt, rungAt } from '../src/game/ladder.ts';
import { buildQuestion } from '../src/game/questions.ts';
import { createRng, seedFrom } from '../src/game/rng.ts';

let checks = 0;
let failures = 0;
const check = (ok: boolean, label: string, detail?: string): void => {
  checks++;
  if (ok) return;
  failures++;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

const nameOf = (atlasId: AtlasId, id: string): string =>
  (atlasId === 'france-departments' ? FRANCE : WORLD).territories.find((t) => t.id === id)?.name ??
  id;

const ORDERS: Record<AtlasId, [string, string, string][]> = {
  'france-departments': [
    ['59', '23', 'Nord (Lille) avant Creuse (Guéret)'],
    ['13', '48', 'Bouches-du-Rhône (Marseille) avant Lozère (Mende)'],
    ['69', '09', 'Rhône (Lyon) avant Ariège (Foix)'],
    ['75', '15', 'Paris avant Cantal, malgré une aire cent fois moindre'],
    ['33', '52', 'Gironde (Bordeaux) avant Haute-Marne (Chaumont)'],
    ['31', '07', 'Haute-Garonne (Toulouse) avant Ardèche (Privas)'],
  ],
  'world-countries': [
    ['BRA', 'BTN', 'Brésil avant Bhoutan'],
    ['CHN', 'MNE', 'Chine avant Monténégro'],
    ['USA', 'BLZ', 'États-Unis avant Belize'],
    ['JPN', 'MNG', 'Japon avant Mongolie — la population prime la superficie'],
    ['DEU', 'ALB', 'Allemagne avant Albanie'],
    ['IND', 'ISL', 'Inde avant Islande'],
  ],
};

for (const atlasId of Object.keys(ORDERS) as AtlasId[]) {
  const atlas = atlasId === 'france-departments' ? 'France' : 'Monde';
  console.log(`\n▸ ${atlas} — ordres attendus`);

  for (const [easy, hard, why] of ORDERS[atlasId]) {
    const a = difficultyOf(atlasId, easy);
    const b = difficultyOf(atlasId, hard);
    check(a < b, why, `${a.toFixed(2)} contre ${b.toFixed(2)}`);
  }

  const { ordered } = difficultyTable(atlasId);
  console.log(
    `  · les plus abordables : ${ordered
      .slice(0, 5)
      .map((t) => t.name)
      .join(', ')}`,
  );
  console.log(
    `  · les plus obscurs   : ${ordered
      .slice(-5)
      .map((t) => t.name)
      .join(', ')}`,
  );
}

console.log('\n▸ Forme des échelons');
for (const atlasId of Object.keys(LADDERS) as AtlasId[]) {
  const rungs = LADDERS[atlasId];

  check(rungs.length === MAX_RUNG + 1, `${atlasId} — nombre d’échelons cohérent`);
  check(
    rungs.at(-1)!.share === 1,
    `${atlasId} — le dernier échelon ouvre tout le vivier`,
    `${rungs.at(-1)!.share}`,
  );
  check(
    rungs.at(-1)!.assist === null,
    `${atlasId} — le dernier échelon n’offre aucune aide au repérage`,
  );

  let previousPool: string[] = [];
  let previousSkills = 0;

  for (const rung of rungs) {
    const pool = poolAt(atlasId, rung.index).map((t) => t.id);

    check(
      pool.length >= 8,
      `${atlasId} — échelon ${rung.index} : vivier suffisant`,
      `${pool.length}`,
    );
    check(
      pool.length >= previousPool.length,
      `${atlasId} — échelon ${rung.index} : le vivier ne rétrécit pas`,
    );
    const lost = previousPool.filter((id) => !pool.includes(id));
    check(
      lost.length === 0,
      `${atlasId} — échelon ${rung.index} : aucun territoire retiré`,
      lost.map((id) => nameOf(atlasId, id)).join(', '),
    );
    check(
      rung.skills.length >= previousSkills,
      `${atlasId} — échelon ${rung.index} : les compétences ne se referment pas`,
    );

    previousPool = pool;
    previousSkills = rung.skills.length;
  }

  const spreads = rungs.map((r) => r.assist ?? 1);
  const widening = spreads.every((s, i) => i === 0 || s >= spreads[i - 1]!);
  check(widening, `${atlasId} — le cadrage d’aide s’élargit à chaque échelon`, spreads.join(' → '));
}

console.log('\n▸ Jouabilité de chaque échelon');
for (const atlasId of Object.keys(LADDERS) as AtlasId[]) {
  for (let index = 0; index <= MAX_RUNG; index++) {
    const rung = rungAt(atlasId, index);
    const pool = poolAt(atlasId, index);
    const rng = createRng(index + 1);

    for (const skill of rung.skills) {
      const buildable = pool.filter((t) => buildQuestion(atlasId, t.id, skill, rng) !== null);
      check(
        buildable.length > pool.length / 2,
        `${atlasId} — échelon ${index} : « ${skill} » s’applique au vivier`,
        `${buildable.length} / ${pool.length}`,
      );
    }
  }
}

console.log('\n▸ Premier contact');
{
  const pool = poolAt('france-departments', 0);
  const names = pool.map((t) => t.name);
  for (const obscure of ['Creuse', 'Lozère', 'Ariège', 'Haute-Marne', 'Cantal']) {
    check(!names.includes(obscure), `le premier échelon français n’inclut pas ${obscure}`);
  }

  for (const obvious of ['Paris', 'Nord', 'Rhône', 'Bouches-du-Rhône']) {
    check(names.includes(obvious), `le premier échelon français inclut ${obvious}`);
  }

  const easiestFive = difficultyTable('france-departments').ordered.slice(0, 5);
  check(
    !easiestFive.some((t) => t.id === '974' || t.id === '973'),
    'l’aire des cartouches d’outre-mer n’est pas comparée à celle de la métropole',
    easiestFive.map((t) => t.name).join(', '),
  );
  console.log(`  · échelon 0 France (${pool.length}) : ${names.join(', ')}`);

  const world = poolAt('world-countries', 0);
  console.log(`  · échelon 0 Monde (${world.length}) : ${world.map((t) => t.name).join(', ')}`);
  check(
    world.some((t) => t.id === 'CHN' || t.id === 'IND' || t.id === 'USA'),
    'le premier échelon mondial contient les États les plus évidents',
  );
}

console.log('\n▸ Jaugeage');
{
  const trial = (ability: number, noise: number, atlasId: AtlasId): number => {
    const rng = createRng(seedFrom(`cal-${ability}-${noise}-${atlasId}`));
    const { byId } = difficultyTable(atlasId);
    let state = startCalibration(atlasId);

    while (!isDone(state)) {
      const question = nextQuestion(state, rng);
      if (!question) break;
      const hardness = byId.get(question.answerId) ?? 1;
      const correct = rng() < Math.max(0, Math.min(1, (ability - hardness) / noise + 0.5));
      state = applyAnswer(state, question.answerId, correct);
    }
    return rungFrom(state);
  };

  for (const atlasId of ['france-departments', 'world-countries'] as AtlasId[]) {
    const label = atlasId === 'france-departments' ? 'France' : 'Monde';
    const at = (ability: number): number => {
      let total = 0;
      const runs = 24;
      for (let i = 0; i < runs; i++) total += trial(ability + i * 1e-4, 0.35, atlasId);
      return total / runs;
    };

    const weak = at(0.15);
    const middling = at(0.5);
    const strong = at(0.9);
    console.log(
      `  · ${label} — faible ${weak.toFixed(1)}, moyen ${middling.toFixed(1)}, fort ${strong.toFixed(1)}`,
    );

    check(weak < middling, `${label} — un joueur faible est placé sous un joueur moyen`);
    check(middling < strong, `${label} — un joueur moyen est placé sous un joueur fort`);
    check(weak <= 1.2, `${label} — un joueur faible commence bas`, weak.toFixed(2));
    check(
      strong >= 2.8,
      `${label} — un joueur fort n’est pas renvoyé au cabotage`,
      strong.toFixed(2),
    );
  }

  for (const atlasId of ['france-departments', 'world-countries'] as AtlasId[]) {
    const label = atlasId === 'france-departments' ? 'France' : 'Monde';
    const entry = rungAt(atlasId, 0);
    const opening = new Set(poolAt(atlasId, 0).map((t) => t.id));
    const { byId } = difficultyTable(atlasId);

    let easy = 0;
    let entrySkill = 0;
    let hardest = 0;
    const runs = 40;

    for (let i = 0; i < runs; i++) {
      const state = startCalibration(atlasId);
      const question = nextQuestion(state, createRng(seedFrom(`first-${atlasId}-${i}`)));
      if (!question) continue;
      if (opening.has(question.answerId)) easy++;
      if (entry.skills.includes(question.skill)) entrySkill++;
      hardest = Math.max(hardest, byId.get(question.answerId) ?? 1);
    }

    console.log(
      `  · ${label} — première question : ${easy}/${runs} dans le premier échelon, difficulté max ${hardest.toFixed(2)}`,
    );
    check(
      easy === runs,
      `${label} — la première question porte sur un territoire du premier échelon`,
      `${easy}/${runs}`,
    );
    check(
      entrySkill === runs,
      `${label} — la première question n’emploie qu’une compétence d’entrée`,
      `${entrySkill}/${runs}`,
    );
    check(
      hardest < 0.25,
      `${label} — la première question reste franchement abordable`,
      hardest.toFixed(2),
    );
  }

  const empty = startCalibration('france-departments');
  check(rungFrom(empty) === 0, 'un jaugeage non commencé place au premier échelon');
  check(!isDone(empty), 'un jaugeage non commencé n’est pas terminé');

  let full = startCalibration('france-departments');
  for (let i = 0; i < CALIBRATION_LENGTH; i++) full = applyAnswer(full, `t${i}`, true);
  check(isDone(full), 'le jaugeage se termine après huit questions');
  check(rungFrom(full) === MAX_RUNG, 'un sans-faute ouvre le dernier échelon', `${rungFrom(full)}`);

  let none = startCalibration('france-departments');
  for (let i = 0; i < CALIBRATION_LENGTH; i++) none = applyAnswer(none, `t${i}`, false);
  check(rungFrom(none) === 0, 'un zéro pointé reste au premier échelon');
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures} / ${checks} contrôles passés\n`);
process.exit(failures === 0 ? 0 : 1);
