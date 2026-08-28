import { MAX_RUNG } from '../src/game/ladder.ts';
import { dueCount, dueQueue } from '../src/game/revision.ts';
import {
  answer,
  comboMultiplier,
  currentQuestion,
  dailyConfig,
  expeditionConfig,
  lessonConfig,
  mend,
  RULES,
  startSession,
  summarize,
  emojiSummary,
  type SessionState,
} from '../src/game/session.ts';
import { createRng, seedFrom, dailyKey } from '../src/game/rng.ts';
import { createCard, review, isMastered, INTERVALS, type Card } from '../src/game/srs.ts';

let failures = 0;
let checks = 0;
const check = (ok: boolean, message: string, detail?: string): void => {
  checks++;
  if (ok) return;
  failures++;
  console.error(`  ✗ ${message}${detail ? ` — ${detail}` : ''}`);
};

function play(
  state: SessionState,
  { skill, thinkMs, rng }: { skill: number; thinkMs: number; rng: () => number },
): SessionState {
  let session = state;
  let clock = session.startedAt;
  let guard = 0;

  while (session.status === 'playing' && guard++ < 500) {
    const question = currentQuestion(session);
    if (!question) break;
    clock += thinkMs;
    const correct = rng() < skill;
    const chosen = correct
      ? question.answerId
      : question.mode === 'choice'
        ? (question.choices.find((c) => c.id !== question.answerId)?.id ?? null)
        : '__faux__';
    session = answer(session, chosen, clock);
  }
  return session;
}

console.log('Simulation de parties\n');

console.log('▸ Expédition');
{
  const trial = (skill: number, thinkMs: number, runs = 20) => {
    let asked = 0;
    let bestCombo = 0;
    let ceilings = 0;
    for (let i = 0; i < runs; i++) {
      const session = play(
        startSession(
          expeditionConfig('france-departments', seedFrom(`exp-${skill}-${i}`) % 90_000, MAX_RUNG),
          0,
        ),
        { skill, thinkMs, rng: createRng(seedFrom(`rng-${skill}-${i}`)) },
      );
      const s = summarize(session, session.startedAt + 60_000);
      asked += s.asked;
      bestCombo += s.bestCombo;
      if (session.endReason === 'completed') ceilings++;
    }
    return { asked: asked / runs, bestCombo: bestCombo / runs, ceilings };
  };

  const expert = trial(0.95, 1_200);
  const novice = trial(0.35, 4_000);
  console.log(
    `  · expert (95 %) : ${expert.asked.toFixed(0)} questions, série moyenne ${expert.bestCombo.toFixed(0)}`,
  );
  console.log(`  · novice (35 %) : ${novice.asked.toFixed(0)} questions`);

  check(expert.asked > 25, 'un joueur expert enchaîne longuement', `${expert.asked.toFixed(0)}`);
  check(
    expert.bestCombo > 10,
    'un joueur expert construit une longue série',
    `${expert.bestCombo.toFixed(1)}`,
  );
  check(
    expert.ceilings === 0 && novice.ceilings === 0,
    'aucune partie ne s’arrête sur le plafond de questions',
    `${expert.ceilings + novice.ceilings} sur 40`,
  );
  check(
    novice.asked < expert.asked,
    'la partie d’un joueur faible est plus courte',
    `${novice.asked.toFixed(0)} contre ${expert.asked.toFixed(0)}`,
  );

  let s = startSession(expeditionConfig('france-departments', 7, MAX_RUNG), 0);
  let clock = 0;
  let overflow = false;
  for (let i = 0; i < 40 && s.status === 'playing'; i++) {
    const q = currentQuestion(s);
    if (!q) break;
    clock += 300;
    s = answer(s, q.answerId, clock);
    if (s.expiresAt !== null && s.expiresAt - clock > RULES.timeCap + 1) overflow = true;
  }
  check(!overflow, 'la réserve de temps reste sous son plafond');
}

console.log('\n▸ Barème');
{
  check(comboMultiplier(0) === 1, 'série nulle : multiplicateur 1');
  check(comboMultiplier(3) === 1.25, 'série de 3 : multiplicateur 1,25');
  check(comboMultiplier(15) === 3, 'série de 15 : multiplicateur 3');
  check(comboMultiplier(999) === 3, 'le multiplicateur est plafonné');

  let previous = Infinity;
  let monotone = true;
  for (let ms = 0; ms <= 10_000; ms += 500) {
    const s = summarize(startSession(dailyConfig('world-countries', 1), 0), 0);
    void s;
    const bonus = comboMultiplier(0);
    void bonus;
  }
  const { speedBonus, rewardDecay } = await import('../src/game/session.ts');
  check(rewardDecay(0) === 1, 'la récompense en temps est pleine au départ');
  check(rewardDecay(999) === RULES.minRewardFactor, 'l’érosion est bornée par le bas');
  check(rewardDecay(25) < rewardDecay(5), 'la récompense s’érode au fil de la partie');
  for (let ms = 0; ms <= 12_000; ms += 250) {
    const bonus = speedBonus(ms);
    if (bonus > previous + 1e-9) monotone = false;
    if (bonus < 0) monotone = false;
    previous = bonus;
  }
  check(monotone, 'le bonus de vitesse décroît sans jamais passer sous zéro');
  check(speedBonus(0) === RULES.maxSpeedBonus, 'réponse immédiate : bonus maximal');
  check(speedBonus(60_000) === 0, 'réponse très lente : aucun bonus');
}

console.log('\n▸ Relevé quotidien');
{
  const key = dailyKey(new Date(2026, 7, 26));
  const seed = seedFrom(`daily:${key}:france-departments`);
  const a = startSession(dailyConfig('france-departments', seed), 0);
  const b = startSession(dailyConfig('france-departments', seed), 999_999);

  const sameQuestions =
    a.questions.length === b.questions.length &&
    a.questions.every((q, i) => q.cardId === b.questions[i]!.cardId);
  check(sameQuestions, 'la même graine produit exactement la même série');
  check(a.questions.length === 10, 'le relevé compte dix questions', `${a.questions.length}`);

  const other = startSession(
    dailyConfig('france-departments', seedFrom(`daily:2026-08-27:france-departments`)),
    0,
  );
  check(
    other.questions[0]!.cardId !== a.questions[0]!.cardId,
    'un autre jour propose une autre série',
  );

  const cardIds = new Set(a.questions.map((q) => q.cardId));
  check(cardIds.size === a.questions.length, 'aucune question n’est posée deux fois');

  const finished = play(a, { skill: 0.7, thinkMs: 2_500, rng: createRng(1) });
  const grid = emojiSummary(finished, key);
  console.log(`  · grille partageable :\n${grid.split('\n').map((l) => `      ${l}`).join('\n')}`);
  check(finished.status === 'finished', 'le relevé se termine');
  check(
    (grid.match(/🟩|🟥/gu) ?? []).length === finished.answers.length,
    'la grille compte une case par réponse',
  );
}

console.log('\n▸ Répétition espacée');
{
  let card: Card = createCard('france-departments:15:locate', 0);
  let now = 0;

  for (let i = 0; i < 3; i++) {
    now = card.due;
    card = review(card, { correct: true, elapsed: 900 }, now);
  }
  check(card.level === 3, 'trois bonnes réponses portent la carte en boîte 3', `${card.level}`);
  check(isMastered(card), 'la boîte 3 vaut acquisition');

  const before = card.level;
  card = review(card, { correct: true, elapsed: 20_000 }, card.due);
  check(card.level === before, 'une réponse hésitante ne fait pas monter de boîte');

  const lapsesBefore = card.lapses;
  card = review(card, { correct: false }, card.due);
  check(card.level === 0, 'une erreur ramène en boîte 0');
  check(card.lapses === lapsesBefore + 1, 'la rechute depuis un niveau acquis est comptée');
  check(!isMastered(card), 'la carte n’est plus acquise');

  let increasing = true;
  for (let i = 1; i < INTERVALS.length; i++) {
    if (INTERVALS[i]! <= INTERVALS[i - 1]!) increasing = false;
  }
  check(increasing, 'les intervalles de révision sont strictement croissants');
}

console.log('\n▸ Atlas monde');
{
  const session = play(startSession(expeditionConfig('world-countries', 3, MAX_RUNG), 0), {
    skill: 0.8,
    thinkMs: 1_500,
    rng: createRng(5),
  });
  const s = summarize(session, session.startedAt + 60_000);
  console.log(`  · ${s.asked} questions, ${s.score} pts, précision ${Math.round(s.accuracy * 100)} %`);
  check(s.asked > 10, 'le mode monde produit assez de questions');

  const noCapital = session.questions.filter(
    (q) => q.mode === 'choice' && q.choices.some((c) => c.label.trim() === ''),
  );
  check(noCapital.length === 0, 'aucune proposition n’est vide', `${noCapital.length} trouvée(s)`);
}

console.log('\n▸ Avaries');
{
  const lengthAt = (skill: number, lives: number | undefined): number => {
    let total = 0;
    const runs = 30;
    for (let i = 0; i < runs; i++) {
      const base = expeditionConfig(
        'france-departments',
        seedFrom(`av-${skill}-${i}`) % 90_000,
        MAX_RUNG,
      );
      const session = play(startSession({ ...base, lives }, 0), {
        skill,
        thinkMs: skill > 0.9 ? 1_200 : 2_500,
        rng: createRng(seedFrom(`avr-${skill}-${i}`)),
      });
      total += session.answers.length;
    }
    return total / runs;
  };

  for (const skill of [0.5, 0.85, 0.95]) {
    const free = lengthAt(skill, undefined);
    const capped = lengthAt(skill, RULES.lives);
    const drift = Math.abs(capped - free) / free;
    console.log(
      `  · ${Math.round(skill * 100)} % : ${free.toFixed(0)} questions sans avaries, ${capped.toFixed(0)} avec (${(drift * 100).toFixed(0)} % d’écart)`,
    );
    check(
      drift < 0.12,
      `à ${Math.round(skill * 100)} % de précision, les avaries ne raccourcissent pas la partie`,
      `${free.toFixed(0)} → ${capped.toFixed(0)}`,
    );
  }

  let wrecked = 0;
  for (let i = 0; i < 20; i++) {
    const session = play(
      startSession(expeditionConfig('france-departments', seedFrom(`w${i}`) % 90_000, MAX_RUNG), 0),
      { skill: 0.6, thinkMs: 2_500, rng: createRng(seedFrom(`wr${i}`)) },
    );
    if (session.endReason === 'wrecked') wrecked++;
  }
  check(wrecked >= 10, 'un joueur moyen finit bel et bien sur les avaries', `${wrecked} / 20`);

  let s = startSession(expeditionConfig('france-departments', 3, MAX_RUNG), 0);
  const first = currentQuestion(s)!;
  s = answer(s, '__faux__', 1_000);
  const wounded = s.wrecks;
  const timeBefore = s.expiresAt;
  s = mend(s, 1_200);
  check(s.wrecks === wounded - 1, 'la seconde chance répare une avarie');
  check(s.answers.length === 0, 'elle efface la réponse fautive');
  check(currentQuestion(s)?.id === first.id, 'elle rend la question ratée');
  check(s.expiresAt === timeBefore, 'elle ne rend pas le temps consommé');
}

console.log('\n▸ File de révision');
{
  const now = 1_000_000;
  const cards: Record<string, Card> = {};

  const make = (id: string, level: number, due: number, lapses = 0): Card => ({
    id,
    level: level as Card['level'],
    due,
    reviews: 3,
    lapses,
    lastReviewed: due - 1,
  });

  cards['france-departments:33:name'] = make('france-departments:33:name', 2, now - 5 * 60_000);
  cards['france-departments:59:locate'] = make('france-departments:59:locate', 1, now - 60 * 60_000);
  cards['france-departments:69:prefecture'] = make(
    'france-departments:69:prefecture',
    2,
    now - 10 * 60_000,
  );
  cards['france-departments:75:name'] = make('france-departments:75:name', 3, now + 3 * 86_400_000);
  cards['world-countries:FRA:flag'] = make('world-countries:FRA:flag', 1, now - 999_999);

  const queue = dueQueue(cards, 'france-departments', now);
  check(queue.length === 3, 'seules les cartes échues de l’atlas sont retenues', `${queue.length}`);
  check(
    queue.every((d) => d.cardId.startsWith('france-departments:')),
    'aucune carte d’un autre atlas ne s’invite dans la file',
  );
  check(
    queue[0]!.cardId === 'france-departments:59:locate',
    'la carte la plus en retard vient en tête',
    queue[0]?.cardId,
  );
  check(
    queue.every((d, i) => i === 0 || d.overdue <= queue[i - 1]!.overdue),
    'la file est ordonnée par retard décroissant',
  );
  check(
    dueCount(cards, 'france-departments', now) === 3,
    'le compteur d’échéances s’accorde avec la file',
  );

  const lesson = startSession(
    lessonConfig('france-departments', 7, MAX_RUNG, queue.map((d) => d.cardId)),
    now,
  );
  check(
    lesson.questions.length === queue.length,
    'la séance pose autant de questions que de cartes échues',
    `${lesson.questions.length} pour ${queue.length}`,
  );
  check(
    lesson.questions.every((q, i) => q.cardId === queue[i]!.cardId),
    'chaque question porte la carte attendue, dans l’ordre d’urgence',
  );
  check(
    lesson.expiresAt === null,
    'une révision n’a pas de chronomètre — elle mesure une rétention, pas une vitesse',
  );

  const again = startSession(
    lessonConfig('france-departments', 7, MAX_RUNG, queue.map((d) => d.cardId)),
    now + 5_000,
  );
  check(
    again.questions.every((q, i) => q.cardId === lesson.questions[i]!.cardId),
    'la séance est reproductible à graine égale',
  );

  const empty = dueQueue({}, 'france-departments', now);
  check(empty.length === 0, 'une progression vierge n’a rien à réviser');
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures} / ${checks} contrôles passés\n`);
process.exit(failures === 0 ? 0 : 1);
