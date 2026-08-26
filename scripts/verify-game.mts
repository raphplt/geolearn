/**
 * Partie simulée de bout en bout.
 *
 *   npx tsx scripts/verify-game.mts
 *
 * Rejoue des parties entières hors de React, avec un joueur artificiel dont on
 * fixe le taux de réussite et le temps de réponse. On vérifie ainsi la boucle
 * complète — file de questions, score, série, réserve de temps, répétition
 * espacée — sans appareil ni interface, donc à chaque modification du moteur.
 */
import {
  answer,
  comboMultiplier,
  currentQuestion,
  dailyConfig,
  expeditionConfig,
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

/** Joueur artificiel : répond juste avec la probabilité `skill`, en `thinkMs`. */
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

/* ── 1. Expédition : un bon joueur doit survivre, un mauvais doit s'éteindre ── */
console.log('▸ Expédition');
{
  const rng = createRng(seedFrom('expert'));
  const expert = play(startSession(expeditionConfig('france-departments', 42), 0), {
    skill: 0.95,
    thinkMs: 1_200,
    rng,
  });
  const expertSummary = summarize(expert, expert.startedAt + 60_000);
  console.log(
    `  · expert  : ${expertSummary.asked} questions, ${expertSummary.score} pts, série max ${expertSummary.bestCombo}, fin « ${expert.endReason} »`,
  );
  check(expertSummary.asked > 25, 'un joueur expert enchaîne longuement', `${expertSummary.asked}`);
  check(expertSummary.bestCombo > 10, 'un joueur expert construit une longue série');
  /* Le point de conception vérifié ici : même un quasi-sans-faute doit finir par
     épuiser sa réserve. Une partie qui s'arrêterait sur le plafond de questions
     ne serait ni une victoire ni une défaite — juste une coupure. */
  check(
    expert.endReason === 'timeout',
    'même un joueur expert finit par épuiser sa réserve',
    `fin « ${expert.endReason} » après ${expertSummary.asked} questions`,
  );

  const novice = play(startSession(expeditionConfig('france-departments', 42), 0), {
    skill: 0.15,
    thinkMs: 4_000,
    rng: createRng(seedFrom('novice')),
  });
  const noviceSummary = summarize(novice, novice.startedAt + 60_000);
  console.log(
    `  · novice  : ${noviceSummary.asked} questions, ${noviceSummary.score} pts, fin « ${novice.endReason} »`,
  );
  check(novice.endReason === 'timeout', 'un joueur faible épuise sa réserve de temps');
  check(
    noviceSummary.asked < expertSummary.asked,
    'la partie d’un joueur faible est plus courte',
  );

  /* La réserve ne doit jamais dépasser son plafond, sans quoi un bon joueur
     accumulerait une avance que plus rien ne pourrait entamer. */
  let s = startSession(expeditionConfig('france-departments', 7), 0);
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

/* ── 2. Multiplicateurs et bonus de vitesse ── */
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
  /* Le bonus de vitesse doit décroître, sans jamais devenir négatif. */
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

/* ── 3. Relevé quotidien : déterminisme ── */
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

/* ── 4. Répétition espacée ── */
console.log('\n▸ Répétition espacée');
{
  let card: Card = createCard('france-departments:15:locate', 0);
  let now = 0;

  /* Trois bonnes réponses rapides doivent mener à l'acquisition. */
  for (let i = 0; i < 3; i++) {
    now = card.due;
    card = review(card, { correct: true, elapsed: 900 }, now);
  }
  check(card.level === 3, 'trois bonnes réponses portent la carte en boîte 3', `${card.level}`);
  check(isMastered(card), 'la boîte 3 vaut acquisition');

  /* Une réponse juste mais laborieuse ne fait pas progresser. */
  const before = card.level;
  card = review(card, { correct: true, elapsed: 20_000 }, card.due);
  check(card.level === before, 'une réponse hésitante ne fait pas monter de boîte');

  /* Une rechute depuis un niveau acquis ramène à zéro et se compte. */
  const lapsesBefore = card.lapses;
  card = review(card, { correct: false }, card.due);
  check(card.level === 0, 'une erreur ramène en boîte 0');
  check(card.lapses === lapsesBefore + 1, 'la rechute depuis un niveau acquis est comptée');
  check(!isMastered(card), 'la carte n’est plus acquise');

  /* Les intervalles doivent être strictement croissants. */
  let increasing = true;
  for (let i = 1; i < INTERVALS.length; i++) {
    if (INTERVALS[i]! <= INTERVALS[i - 1]!) increasing = false;
  }
  check(increasing, 'les intervalles de révision sont strictement croissants');
}

/* ── 5. Atlas monde ── */
console.log('\n▸ Atlas monde');
{
  const session = play(startSession(expeditionConfig('world-countries', 3), 0), {
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

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures} / ${checks} contrôles passés\n`);
process.exit(failures === 0 ? 0 : 1);
