
export type RoseBranch = {
  light: string;
  dark: string;
  angle: number;
  rank: 0 | 1 | 2;
};

export type RoseOptions = {
  cx: number;
  cy: number;
  radius: number;
  hub?: number;
  falloff?: readonly [number, number];
};

const TAU = Math.PI * 2;
const round = (n: number): number => Math.round(n * 100) / 100;
const p = (x: number, y: number): string => `${round(x)},${round(y)}`;

const polar = (cx: number, cy: number, angle: number, r: number): [number, number] => {
  const theta = angle - Math.PI / 2;
  return [cx + Math.cos(theta) * r, cy + Math.sin(theta) * r];
};

export function roseBranches(count: 8 | 16, opts: RoseOptions): RoseBranch[] {
  const { cx, cy, radius, hub = 0.16, falloff = [0.62, 0.34] } = opts;

  const step = TAU / count;
  const halfStep = step / 2;
  const hubRadius = radius * hub;
  const branches: RoseBranch[] = [];

  for (let i = 0; i < count; i++) {
    const angle = i * step;

    const rank: 0 | 1 | 2 =
      i % (count / 4) === 0 ? 0 : count === 16 && i % 2 === 0 ? 1 : 2;

    const tipRadius = rank === 0 ? radius : radius * falloff[rank - 1]!;
    const baseRadius = hubRadius * (rank === 0 ? 1 : rank === 1 ? 0.78 : 0.55);

    const tip = polar(cx, cy, angle, tipRadius);
    const left = polar(cx, cy, angle - halfStep, baseRadius);
    const right = polar(cx, cy, angle + halfStep, baseRadius);

    branches.push({
      angle,
      rank,
      light: `M${p(cx, cy)}L${p(left[0], left[1])}L${p(tip[0], tip[1])}Z`,
      dark: `M${p(cx, cy)}L${p(tip[0], tip[1])}L${p(right[0], right[1])}Z`,
    });
  }

  return branches;
}

export function roseTicks(opts: {
  cx: number;
  cy: number;
  radius: number;
  long: number;
  short: number;
}): { d: string; major: boolean }[] {
  const { cx, cy, radius, long, short } = opts;
  const ticks: { d: string; major: boolean }[] = [];

  for (let deg = 0; deg < 360; deg += 10) {
    const major = deg % 30 === 0;
    const angle = (deg * Math.PI) / 180;
    const outer = polar(cx, cy, angle, radius);
    const inner = polar(cx, cy, angle, radius - (major ? long : short));
    ticks.push({ d: `M${p(outer[0], outer[1])}L${p(inner[0], inner[1])}`, major });
  }

  return ticks;
}

export function rhumbLines(cx: number, cy: number, radius: number, count = 32): string {
  const step = TAU / count;
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const end = polar(cx, cy, i * step, radius);
    parts.push(`M${p(cx, cy)}L${p(end[0], end[1])}`);
  }
  return parts.join('');
}

export const CARDINAL_LABELS = ['N', 'E', 'S', 'O'] as const;
