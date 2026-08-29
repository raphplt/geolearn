import type { AtlasId } from '@/data';
import { difficultyTable } from './difficulty';
import { rungsOf } from './ladder';
import { buildQuestion, SKILLS_BY_ATLAS, type Question, type Skill } from './questions';

export const CALIBRATION_LENGTH = 8;

const UP = [0.2, 0.18, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06];

const DOWN_RATIO = 0.55;

const START = 0.08;

export type Calibration = {
  atlasId: AtlasId;
  step: number;
  ability: number;
  asked: string[];
  correct: number;
};

export const startCalibration = (atlasId: AtlasId): Calibration => ({
  atlasId,
  step: 0,
  ability: START,
  asked: [],
  correct: 0,
});

export const isDone = (state: Calibration): boolean => state.step >= CALIBRATION_LENGTH;

function skillsAt(atlasId: AtlasId, ability: number): readonly Skill[] {
  const rungs = rungsOf(atlasId);
  let unlocked = rungs[0]!.skills;
  for (const rung of rungs) if (ability >= rung.share) unlocked = rung.skills;
  return unlocked;
}

export function nextQuestion(state: Calibration, rng: () => number): Question | null {
  const { ordered, byId } = difficultyTable(state.atlasId);
  const asked = new Set(state.asked);

  const candidates = ordered
    .filter((t) => !asked.has(t.id))
    .map((t) => ({ t, gap: Math.abs((byId.get(t.id) ?? 1) - state.ability) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 8);

  const skills = skillsAt(state.atlasId, state.ability);

  for (let attempt = 0; attempt < 12; attempt++) {
    const pick = candidates[Math.floor(rng() * candidates.length)];
    const skill = skills[Math.floor(rng() * skills.length)];
    if (!pick || !skill) continue;
    if (skill === 'locate') continue;
    const question = buildQuestion(state.atlasId, pick.t.id, skill, rng);
    if (question) return question;
  }

  for (const candidate of candidates) {
    for (const skill of SKILLS_BY_ATLAS[state.atlasId]) {
      if (skill === 'locate') continue;
      const question = buildQuestion(state.atlasId, candidate.t.id, skill, rng);
      if (question) return question;
    }
  }
  return null;
}

export function applyAnswer(
  state: Calibration,
  territoryId: string,
  correct: boolean,
): Calibration {
  const step = UP[Math.min(state.step, UP.length - 1)]!;
  const ability = Math.min(1, Math.max(0, state.ability + (correct ? step : -step * DOWN_RATIO)));

  return {
    ...state,
    step: state.step + 1,
    ability,
    asked: [...state.asked, territoryId],
    correct: state.correct + (correct ? 1 : 0),
  };
}

export function rungFrom(state: Calibration): number {
  if (state.step === 0) return 0;
  const rungs = rungsOf(state.atlasId);
  let floor = 0;
  for (const rung of rungs) if (state.ability + 0.06 >= rung.share) floor = rung.index;
  return floor;
}
