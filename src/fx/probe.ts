import { motion } from '@/theme/tokens';

/**
 * A small, always-off-in-production probe for the five journeys of the audit.
 *
 * It answers three of the questions the plan asks — how long a touch takes to
 * produce a visible reaction, which spans block the JavaScript thread, and how
 * long a loading state is actually on screen — without pulling in a profiler.
 * Frame drops on the UI thread are the one thing it cannot see; use the
 * platform profiler (Perfetto on Android, Instruments on iOS) for those.
 */

export type Sample = {
  label: string;
  ms: number;
  at: number;
  over: boolean;
};

type Listener = (samples: readonly Sample[]) => void;

const KEEP = 60;

let enabled = false;
let samples: Sample[] = [];
const pending = new Map<string, number>();
const listeners = new Set<Listener>();

let stallTimer: ReturnType<typeof setInterval> | null = null;
let lastTick = 0;

const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

function push(label: string, ms: number, budget: number): void {
  const sample: Sample = { label, ms, at: Date.now(), over: ms > budget };
  samples = [sample, ...samples].slice(0, KEEP);
  for (const listener of listeners) listener(samples);
  if (sample.over && __DEV__) {
    console.warn(`[probe] ${label} — ${ms.toFixed(0)} ms (budget ${budget} ms)`);
  }
}

export const probe = {
  get enabled(): boolean {
    return enabled;
  },

  /** Turns measurement on. Never call this outside a development build. */
  enable(on: boolean): void {
    enabled = on && __DEV__;
    if (enabled) {
      lastTick = now();
      stallTimer ??= setInterval(() => {
        const t = now();
        const drift = t - lastTick - 16;
        lastTick = t;
        if (drift > motion.budget.perceptiblePause)
          push('js-stall', drift, motion.budget.perceptiblePause);
      }, 16);
      return;
    }
    if (stallTimer) {
      clearInterval(stallTimer);
      stallTimer = null;
    }
  },

  /** Opens a span. Call the returned function once the work is on screen. */
  open(label: string, budget = motion.budget.perceptiblePause): () => void {
    if (!enabled) return () => undefined;
    const started = now();
    return () => push(label, now() - started, budget);
  },

  /** Times a synchronous span — building a queue, decoding an atlas. */
  span<T>(label: string, work: () => T, budget = motion.budget.perceptiblePause): T {
    if (!enabled) return work();
    const started = now();
    const result = work();
    push(label, now() - started, budget);
    return result;
  },

  /** Marks the instant of a touch, closed by `reacted` on the next render. */
  touched(label: string): void {
    if (!enabled) return;
    pending.set(label, now());
  },

  /** Closes a touch span: the reaction is now committed to the screen. */
  reacted(label: string): void {
    if (!enabled) return;
    const started = pending.get(label);
    if (started === undefined) return;
    pending.delete(label);
    push(`touch:${label}`, now() - started, motion.budget.touchResponse);
  },

  samples(): readonly Sample[] {
    return samples;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  clear(): void {
    samples = [];
    pending.clear();
    for (const listener of listeners) listener(samples);
  },

  /** One line per journey, ready to paste into a report. */
  report(): string {
    const byLabel = new Map<string, number[]>();
    for (const sample of samples) {
      const list = byLabel.get(sample.label) ?? [];
      list.push(sample.ms);
      byLabel.set(sample.label, list);
    }

    return [...byLabel.entries()]
      .map(([label, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        const worst = sorted.at(-1) ?? 0;
        return `${label} — n=${values.length} médiane ${median.toFixed(0)} ms, pire ${worst.toFixed(0)} ms`;
      })
      .join('\n');
  },
};
