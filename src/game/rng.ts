/**
 * Aléatoire **déterministe et reproductible**.
 *
 * `Math.random` ne convient pas : le défi quotidien doit proposer exactement la
 * même série à tout le monde, et un tirage rejoué avec la même graine doit
 * redonner la même partie — c'est ce qui permettra, en v2, de rejouer le duel
 * d'un adversaire sans transmettre la liste des questions.
 */

/** PRNG mulberry32 : 32 bits d'état, excellente distribution, quelques opérations. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hachage FNV-1a d'une chaîne vers une graine 32 bits. */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Graine du défi quotidien : dérivée de la date locale du joueur.
 *
 * Date **locale** et non UTC, délibérément. Un joueur qui ouvre l'application à
 * 23 h à Paris et un autre à 8 h à Nouméa doivent chacun avoir « le défi
 * d'aujourd'hui » selon leur propre calendrier ; caler sur UTC ferait basculer
 * le défi en pleine soirée pour les uns et en milieu de journée pour les autres.
 */
export function dailyKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Entier dans [0, max). */
export const randInt = (rng: () => number, max: number): number => Math.floor(rng() * max);

/** Mélange de Fisher-Yates, sur une copie. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** `count` éléments distincts, tirés sans remise. */
export function sample<T>(items: readonly T[], count: number, rng: () => number): T[] {
  if (count >= items.length) return shuffle(items, rng);
  return shuffle(items, rng).slice(0, count);
}

/**
 * Tirage pondéré sans remise.
 *
 * Sert à choisir les leurres : on veut que les candidats les plus confusibles
 * sortent souvent, sans jamais être *certains*, sinon les mauvaises réponses
 * deviennent prévisibles et le joueur apprend à reconnaître le piège plutôt que
 * la bonne réponse.
 */
export function weightedSample<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  count: number,
  rng: () => number,
): T[] {
  const pool = items.map((item) => ({ item, weight: Math.max(1e-6, weightOf(item)) }));
  const out: T[] = [];

  for (let n = 0; n < count && pool.length > 0; n++) {
    let total = 0;
    for (const entry of pool) total += entry.weight;

    let threshold = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      threshold -= pool[i]!.weight;
      if (threshold <= 0) {
        index = i;
        break;
      }
    }
    out.push(pool[index]!.item);
    pool.splice(index, 1);
  }

  return out;
}
