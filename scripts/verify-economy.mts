import { earningsFor, INKS, HINTS, MAX_RANK, RANKS, rankFor } from '../src/game/economy.ts';
import { BREVETS, earnedBrevets, newBrevets } from '../src/game/brevets.ts';
import { cartouchesOf, masteryOf } from '../src/game/mastery.ts';
import { carnetPayout, isComplete, questsFor, QUESTS_PER_DAY } from '../src/game/quests.ts';
import { MAX_RUNG } from '../src/game/ladder.ts';
import { SKILLS_BY_ATLAS } from '../src/game/questions.ts';
import { createRng, seedFrom } from '../src/game/rng.ts';
import {
  advance,
  answer,
  currentQuestion,
  expeditionConfig,
  startSession,
  summarize,
  type SessionState,
} from '../src/game/session.ts';
import { createCard, review, MAX_LEVEL, type Card, type CardId } from '../src/game/srs.ts';
import { ATLASES } from '../src/data/index.ts';

let checks = 0;
let failures = 0;
const check = (ok: boolean, label: string, detail?: string): void => {
  checks++;
  if (ok) return;
  failures++;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n▸ Rangs');
{
  check(RANKS[0]!.at === 0, 'le premier rang s’obtient sans rien');
  let increasing = true;
  for (let i = 1; i < RANKS.length; i++) {
    if (RANKS[i]!.at <= RANKS[i - 1]!.at) increasing = false;
  }
  check(increasing, 'les seuils de rang sont strictement croissants');
  check(rankFor(0).index === 0, 'une bourse vide reste au premier rang');
  check(
    rankFor(RANKS.at(-1)!.at + 10_000).index === MAX_RANK,
    'l’expérience au-delà du dernier seuil ne crée pas de rang fantôme',
  );

  const france = ATLASES['france-departments'];
  const cards: Record<CardId, Card> = {};
  const skills = SKILLS_BY_ATLAS['france-departments'];
  let promotions = 0;
  for (const territory of france.territories) {
    for (const skill of skills) {
      cards[`france-departments:${territory.id}:${skill}`] = {
        id: `france-departments:${territory.id}:${skill}`,
        level: MAX_LEVEL,
        due: 0,
        reviews: MAX_LEVEL,
        lapses: 0,
        lastReviewed: 0,
      };
      promotions += MAX_LEVEL;
    }
  }
  const mastery = masteryOf(cards, 'france-departments');
  const seals = cartouchesOf(mastery, 'france-departments', france).filter((c) => c.sealed).length;
  const full = earningsFor('expedition', blankSummary(), {
    promotions,
    masteries: mastery.mastered,
    seals,
  });

  const share = RANKS.at(-1)!.at / full.xp;
  console.log(
    `  · France entièrement sue : ${full.xp.toLocaleString('fr-FR')} xp, ${full.doublons.toLocaleString('fr-FR')} doublons, ${seals} cartouches`,
  );
  console.log(`  · l’amirauté tombe à ${(share * 100).toFixed(0)} % de cet atlas`);
  check(
    share > 0.4 && share < 1,
    'l’amirauté demande l’essentiel d’un atlas, sans exiger la perfection',
    `${(share * 100).toFixed(0)} %`,
  );
}

console.log('\n▸ Pouvoir d’achat');
{
  const cards: Record<CardId, Card> = {};
  let doublons = 0;
  let xp = 0;
  let now = 0;

  for (let run = 0; run < 20; run++) {
    now += 24 * 60 * 60 * 1000;
    let session: SessionState = startSession(
      expeditionConfig('france-departments', seedFrom(`eco-${run}`) % 90_000, MAX_RUNG),
      now,
    );
    const rng = createRng(seedFrom(`ecorng-${run}`));
    let clock = now;

    while (session.status === 'playing') {
      const question = currentQuestion(session);
      if (!question) break;
      clock += 2_200;
      const correct = rng() < 0.8;
      const chosen = correct
        ? question.answerId
        : question.mode === 'choice'
          ? (question.choices.find((c) => c.id !== question.answerId)?.id ?? null)
          : '__faux__';
      session = answer(session, chosen, clock);
      session = advance(session, clock);
    }

    const before = masteryOf(cards, 'france-departments').mastered;
    let promotions = 0;
    for (const record of session.answers) {
      const card = cards[record.cardId] ?? createCard(record.cardId, clock);
      const next = review(card, { correct: record.correct, elapsed: record.elapsed }, clock);
      if (next.level > card.level) promotions++;
      cards[record.cardId] = next;
    }
    const after = masteryOf(cards, 'france-departments').mastered;

    const earnings = earningsFor('expedition', summarize(session, clock), {
      promotions,
      masteries: after - before,
      seals: 0,
    });
    doublons += earnings.doublons;
    xp += earnings.xp;
  }

  const cheapest = Math.min(...HINTS.map((h) => h.price));
  const ink = INKS.find((i) => i.price > 0)!;
  console.log(`  · après 20 parties à 80 % : ${doublons} doublons, ${xp} xp (${rankFor(xp).name})`);
  console.log(
    `  · soit ${Math.floor(doublons / cheapest)} indices, ou ${(doublons / ink.price).toFixed(1)} × « ${ink.name} »`,
  );

  check(
    doublons >= cheapest * 8,
    'vingt parties paient une réserve d’indices confortable',
    `${doublons} doublons pour un indice à ${cheapest}`,
  );
  check(
    doublons >= ink.price,
    'vingt parties permettent de s’offrir la première encre',
    `${doublons} doublons pour une encre à ${ink.price}`,
  );
  check(
    doublons < ink.price * 2,
    'vingt parties n’épuisent pas la boutique',
    `${doublons} doublons pour une encre à ${ink.price}`,
  );
  check(
    rankFor(xp).index >= 1 && rankFor(xp).index <= 5,
    'vingt parties font monter en rang sans mener à l’amirauté',
    rankFor(xp).name,
  );
}

console.log('\n▸ Carnet de bord');
{
  const key = '2026-08-28';
  const a = questsFor(key);
  const b = questsFor(key);
  check(a.length === QUESTS_PER_DAY, 'le carnet compte trois objectifs', `${a.length}`);
  check(
    a.every((q, i) => q.id === b[i]!.id),
    'le carnet d’une date est reproductible',
  );
  check(
    new Set(a.map((q) => q.kind)).size === a.length,
    'les trois objectifs sont de natures différentes',
    a.map((q) => q.kind).join(', '),
  );

  const next = questsFor('2026-08-29');
  check(
    a.map((q) => q.id).join() !== next.map((q) => q.id).join(),
    'deux jours consécutifs proposent des carnets distincts',
  );

  const done = questsFor(key, Object.fromEntries(a.map((q) => [q.id, q.target])));
  check(done.every(isComplete), 'un carnet rempli est bien détecté comme tel');

  const first = carnetPayout(done, 0);
  const second = carnetPayout(done, first.completed);
  check(first.doublons > 0, 'un carnet rempli paie');
  check(second.doublons === 0, 'un carnet déjà payé ne repaie pas', `${second.doublons}`);

  const partial = questsFor(key, { [a[0]!.id]: a[0]!.target });
  const step1 = carnetPayout(partial, 0);
  const step2 = carnetPayout(done, step1.completed);
  check(
    step1.doublons + step2.doublons === first.doublons,
    'payer en deux fois donne le même total qu’en une',
    `${step1.doublons} + ${step2.doublons} contre ${first.doublons}`,
  );
}

console.log('\n▸ Brevets');
{
  const ids = BREVETS.map((b) => b.id);
  check(new Set(ids).size === ids.length, 'aucun brevet n’a d’identifiant en double');
  check(
    BREVETS.every((b) => b.reward > 0),
    'tout brevet verse quelque chose',
  );

  const vierge = {
    cards: {},
    xp: 0,
    longestStreak: 0,
    floor: 0,
    bestCombo: 0,
  };
  check(earnedBrevets(vierge).length === 0, 'une progression vierge n’a mérité aucun brevet');

  const cards: Record<CardId, Card> = {};
  for (const [atlasId, atlas] of Object.entries(ATLASES)) {
    for (const territory of atlas.territories) {
      for (const skill of ['name', 'locate', 'prefecture', 'code', 'capital', 'flag']) {
        cards[`${atlasId}:${territory.id}:${skill}`] = {
          id: `${atlasId}:${territory.id}:${skill}`,
          level: MAX_LEVEL,
          due: 0,
          reviews: 9,
          lapses: 0,
          lastReviewed: 0,
        };
      }
    }
  }
  const parfait = {
    cards,
    xp: RANKS.at(-1)!.at,
    longestStreak: 365,
    floor: 4,
    bestCombo: 200,
  };
  const all = earnedBrevets(parfait);
  const missing = ids.filter((id) => !all.includes(id));
  check(missing.length === 0, 'tous les brevets sont atteignables', missing.join(', '));

  const already = Object.fromEntries(all.map((id) => [id, 1]));
  check(newBrevets(parfait, already).ids.length === 0, 'un brevet obtenu n’est jamais redonné');
  console.log(`  · ${BREVETS.length} brevets, tous atteignables`);
}

console.log('\n▸ Comptoir');
{
  check(INKS.filter((i) => i.price === 0).length === 1, 'une seule encre est offerte d’emblée');
  check(
    INKS.every((i, index) => index === 0 || i.price > 0),
    'les encres suivantes se paient',
  );
  check(
    HINTS.every((h) => h.price > 0 && h.price < INKS[1]!.price),
    'un indice coûte moins cher qu’une encre',
  );
  check(new Set(HINTS.map((h) => h.id)).size === HINTS.length, 'les indices sont distincts');
}

function blankSummary() {
  return {
    score: 0,
    asked: 0,
    correct: 0,
    accuracy: 0,
    bestCombo: 0,
    duration: 0,
    medianElapsed: 0,
  };
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures} / ${checks} contrôles passés\n`);
process.exit(failures === 0 ? 0 : 1);
