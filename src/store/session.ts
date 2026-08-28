import { create } from 'zustand';

import type { SessionReport } from './progress';
import {
  answer as applyAnswer,
  expire as applyExpire,
  mend as applyMend,
  startSession,
  summarize,
  type SessionConfig,
  type SessionState,
  type SessionSummary,
} from '@/game/session';

type SessionStore = {
  session: SessionState | null;
  summary: SessionSummary | null;
  pending: SessionConfig | null;
  report: SessionReport | null;
  setReport: (report: SessionReport | null) => void;
  prepare: (config: SessionConfig) => void;
  startPending: () => void;
  start: (config: SessionConfig) => void;
  answer: (chosenId: string | null) => SessionState | null;
  expire: () => void;
  repair: () => void;
  clear: () => void;
};

export const useSession = create<SessionStore>((set, get) => ({
  session: null,
  summary: null,
  pending: null,
  report: null,

  setReport: (report) => set({ report }),

  prepare: (config) => set({ pending: config, session: null, summary: null, report: null }),

  startPending: () => {
    const config = get().pending;
    if (!config) return;
    set({ session: startSession(config, Date.now()), summary: null, pending: null, report: null });
  },

  start: (config) => {
    const now = Date.now();
    set({ session: startSession(config, now), summary: null, pending: null, report: null });
  },

  answer: (chosenId) => {
    const current = get().session;
    if (!current) return null;
    const now = Date.now();
    const next = applyAnswer(current, chosenId, now);
    set({
      session: next,
      summary: next.status === 'finished' ? summarize(next, now) : null,
    });
    return next;
  },

  expire: () => {
    const current = get().session;
    if (!current) return;
    const now = Date.now();
    const next = applyExpire(current, now);
    if (next === current) return;
    set({ session: next, summary: summarize(next, now) });
  },

  repair: () => {
    const current = get().session;
    if (!current) return;
    const next = applyMend(current, Date.now());
    if (next === current) return;
    set({ session: next, summary: null, report: null });
  },

  clear: () => set({ session: null, summary: null, pending: null, report: null }),
}));
