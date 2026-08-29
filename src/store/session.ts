import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { SessionReport } from './progress';
import {
  advance as applyAdvance,
  answer as applyAnswer,
  expire as applyExpire,
  mend as applyMend,
  startSession,
  summarize,
  suspend as applySuspend,
  wake as applyWake,
  type SessionConfig,
  type SessionState,
  type SessionSummary,
} from '@/game/session';

const RESUME_KEY = 'portulan.session';

const RESUME_MAX_AGE = 6 * 60 * 60 * 1000;

/**
 * The queue is not stored: it is deterministic from the seed, so only the
 * number of questions already drawn is kept and the drawer is replayed. What
 * reaches the disk after every answer is therefore a few hundred bytes, not the
 * whole board.
 */
type Snapshot = {
  savedAt: number;
  drawn: number;
  state: Omit<SessionState, 'draw' | 'questions'>;
};

type SessionStore = {
  session: SessionState | null;
  summary: SessionSummary | null;
  report: SessionReport | null;
  resumable: SessionState | null;
  setReport: (report: SessionReport | null) => void;
  start: (config: SessionConfig) => SessionState;
  answer: (chosenId: string | null) => SessionState | null;
  advance: () => SessionState | null;
  expire: () => void;
  repair: () => void;
  /** The application left the foreground; every clock stops. */
  suspend: () => void;
  /** The application is back; every clock is shifted by the absence. */
  wake: () => void;
  clear: () => void;
  loadResumable: () => Promise<void>;
  resume: () => SessionState | null;
  dropResumable: () => void;
};

/** Replays the question drawer of a session read back from storage. */
function rehydrate({ state, drawn }: Snapshot): SessionState | null {
  const fresh = startSession(state.config, state.startedAt);
  const questions = fresh.questions.slice();
  let draw = fresh.draw;

  while (draw && questions.length < drawn) {
    const question = draw();
    if (!question) {
      draw = null;
      break;
    }
    questions.push(question);
  }

  if (questions.length <= state.index) return null;
  return { ...state, questions, draw };
}

let writing: ReturnType<typeof setTimeout> | null = null;

function persist(session: SessionState | null, immediate = false): void {
  if (writing) {
    clearTimeout(writing);
    writing = null;
  }

  if (!session || session.status !== 'playing' || session.answers.length === 0) {
    void AsyncStorage.removeItem(RESUME_KEY);
    return;
  }

  const { draw: _draw, questions, ...state } = session;
  const snapshot: Snapshot = { savedAt: Date.now(), drawn: questions.length, state };
  const write = (): void => {
    void AsyncStorage.setItem(RESUME_KEY, JSON.stringify(snapshot));
  };

  /* Off the answer's critical path — except on the way out, where there is none. */
  if (immediate) {
    write();
    return;
  }
  writing = setTimeout(() => {
    writing = null;
    write();
  }, 400);
}

export const useSession = create<SessionStore>((set, get) => ({
  session: null,
  summary: null,
  report: null,
  resumable: null,

  setReport: (report) => set({ report }),

  start: (config) => {
    const session = startSession(config, Date.now());
    set({ session, summary: null, report: null, resumable: null });
    void AsyncStorage.removeItem(RESUME_KEY);
    return session;
  },

  answer: (chosenId) => {
    const current = get().session;
    if (!current) return null;
    const now = Date.now();
    const next = applyAnswer(current, chosenId, now);
    if (next === current) return current;
    set({
      session: next,
      summary: next.status === 'finished' ? summarize(next, now) : null,
    });
    persist(next);
    return next;
  },

  advance: () => {
    const current = get().session;
    if (!current) return null;
    const next = applyAdvance(current, Date.now());
    if (next === current) return current;
    set({ session: next });
    persist(next);
    return next;
  },

  expire: () => {
    const current = get().session;
    if (!current) return;
    const now = Date.now();
    const next = applyExpire(current, now);
    if (next === current) return;
    set({ session: next, summary: summarize(next, now) });
    persist(next);
  },

  repair: () => {
    const current = get().session;
    if (!current) return;
    const next = applyMend(current, Date.now());
    if (next === current) return;
    set({ session: next, summary: null, report: null });
    persist(next);
  },

  suspend: () => {
    const current = get().session;
    if (!current) return;
    const next = applySuspend(current, Date.now());
    if (next === current) return;
    set({ session: next });
    persist(next, true);
  },

  wake: () => {
    const current = get().session;
    if (!current) return;
    const next = applyWake(current, Date.now());
    if (next === current) return;
    set({ session: next });
    persist(next);
  },

  clear: () => {
    set({ session: null, summary: null, report: null });
    void AsyncStorage.removeItem(RESUME_KEY);
  },

  loadResumable: async () => {
    try {
      const raw = await AsyncStorage.getItem(RESUME_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as Snapshot;
      if (Date.now() - snapshot.savedAt > RESUME_MAX_AGE) {
        void AsyncStorage.removeItem(RESUME_KEY);
        return;
      }
      set({ resumable: rehydrate(snapshot) });
    } catch {
      void AsyncStorage.removeItem(RESUME_KEY);
    }
  },

  resume: () => {
    const saved = get().resumable;
    if (!saved) return null;
    /*
     * The clock stopped when the application did, so the absence is given back
     * whole. A session that was properly backgrounded knows when that started;
     * one that died on the spot falls back to the last question shown, which
     * simply restarts it.
     */
    const session = applyWake(
      { ...saved, suspendedAt: saved.suspendedAt ?? saved.askedAt },
      Date.now(),
    );
    set({ session, summary: null, report: null, resumable: null });
    return session;
  },

  dropResumable: () => {
    set({ resumable: null });
    void AsyncStorage.removeItem(RESUME_KEY);
  },
}));
