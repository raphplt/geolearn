import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ATLASES, type AtlasId } from '@/data';
import { newBrevets, type BrevetContext } from '@/game/brevets';
import { earningsFor, type Earnings, type HintId, type InkId } from '@/game/economy';
import { masteryOf, sealedIds } from '@/game/mastery';
import { dailyKey } from '@/game/rng';
import { applyQuestProgress, carnetPayout, questDelta, questsFor } from '@/game/quests';
import { createCard, review, MASTERED_LEVEL, type Card, type CardId } from '@/game/srs';
import type { SessionMode, SessionState, SessionSummary } from '@/game/session';
import type { SchemePreference } from '@/theme';

export type DailyResult = {
  dateKey: string;
  score: number;
  correct: number;
  asked: number;
  atlasId: AtlasId;
};

export type Settings = {
  scheme: SchemePreference;
  haptics: boolean;
  lastAtlas: AtlasId;
  floor: number;
  onboarded: boolean;
};

export type Records = {
  best: Record<string, number>;
  totalAsked: number;
  totalCorrect: number;
  totalSessions: number;
  totalPlayTime: number;
  bestCombo: number;
};

export type Purse = {
  doublons: number;
  xp: number;
  hints: Partial<Record<HintId, number>>;
  inks: InkId[];
  ink: InkId;
};

export type Carnet = {
  dateKey: string;
  progress: Record<string, number>;
  paid: number;
};

export type SessionReport = {
  earnings: Earnings;
  brevets: string[];
  brevetDoublons: number;
  carnet: { completed: number; doublons: number };
  xpBefore: number;
  xpAfter: number;
};

type ProgressState = {
  cards: Record<CardId, Card>;
  records: Records;
  purse: Purse;
  carnet: Carnet;
  brevets: Record<string, number>;
  seals: string[];
  daily: {
    results: Record<string, DailyResult>;
    currentStreak: number;
    longestStreak: number;
    lastCompleted: string | null;
  };
  settings: Settings;
  hydrated: boolean;

  recordSession: (
    state: SessionState,
    summary: SessionSummary,
    now?: number,
  ) => SessionReport | null;
  completeDaily: (result: DailyResult, now?: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  buyHint: (id: HintId, price: number) => boolean;
  useHint: (id: HintId) => boolean;
  buyInk: (id: InkId, price: number) => boolean;
  selectInk: (id: InkId) => void;
  resetProgress: () => void;
};

const emptyRecords = (): Records => ({
  best: {},
  totalAsked: 0,
  totalCorrect: 0,
  totalSessions: 0,
  totalPlayTime: 0,
  bestCombo: 0,
});

const emptyPurse = (): Purse => ({ doublons: 0, xp: 0, hints: {}, inks: ['sepia'], ink: 'sepia' });

const emptyCarnet = (): Carnet => ({ dateKey: dailyKey(), progress: {}, paid: 0 });

const defaultSettings = (): Settings => ({
  scheme: 'system',
  haptics: true,
  lastAtlas: 'france-departments',
  floor: 0,
  onboarded: false,
});

export const recordKey = (atlasId: AtlasId, mode: SessionMode): string => `${atlasId}:${mode}`;

function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() - 1);
  return dailyKey(date);
}

function masteredTotal(cards: Record<CardId, Card>): number {
  let total = 0;
  for (const atlasId of Object.keys(ATLASES) as AtlasId[]) {
    total += masteryOf(cards, atlasId, ATLASES[atlasId]).mastered;
  }
  return total;
}

function allSeals(cards: Record<CardId, Card>): string[] {
  return (Object.keys(ATLASES) as AtlasId[]).flatMap((atlasId) =>
    sealedIds(cards, atlasId, ATLASES[atlasId]),
  );
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      cards: {},
      records: emptyRecords(),
      purse: emptyPurse(),
      carnet: emptyCarnet(),
      brevets: {},
      seals: [],
      daily: { results: {}, currentStreak: 0, longestStreak: 0, lastCompleted: null },
      settings: defaultSettings(),
      hydrated: false,

      recordSession: (session, summary, now = Date.now()) => {
        const state = get();
        if (summary.asked === 0) return null;

        const cards = { ...state.cards };
        let promotions = 0;

        for (const answer of session.answers) {
          const before = cards[answer.cardId] ?? createCard(answer.cardId, now);
          const after = review(before, { correct: answer.correct, elapsed: answer.elapsed }, now);
          if (after.level > before.level) promotions++;
          cards[answer.cardId] = after;
        }

        const masteredBefore = masteredTotal(state.cards);
        const masteredAfter = masteredTotal(cards);
        const masteries = Math.max(0, masteredAfter - masteredBefore);

        const sealsAfter = allSeals(cards);
        const freshSeals = sealsAfter.filter((id) => !state.seals.includes(id));

        const learning = { promotions, masteries, seals: freshSeals.length };

        const earnings = earningsFor(session.config.mode, summary, learning);

        const today = dailyKey(new Date(now));
        const carnetBase =
          state.carnet.dateKey === today ? state.carnet : { dateKey: today, progress: {}, paid: 0 };
        const carnetProgress = applyQuestProgress(
          carnetBase.progress,
          today,
          questDelta(session.config.mode, summary, learning),
        );
        const payout = carnetPayout(questsFor(today, carnetProgress), carnetBase.paid);

        const bestCombo = Math.max(state.records.bestCombo, summary.bestCombo);
        const xpAfter = state.purse.xp + earnings.xp;
        const context: BrevetContext = {
          cards,
          xp: xpAfter,
          longestStreak: state.daily.longestStreak,
          bestExpedition: state.records.best[recordKey(session.config.atlasId, 'expedition')] ?? 0,
          floor: state.settings.floor,
          bestCombo,
        };
        const brevets = newBrevets(context, state.brevets);

        const key = recordKey(session.config.atlasId, session.config.mode);
        const brevetDates = { ...state.brevets };
        for (const id of brevets.ids) brevetDates[id] = now;

        set({
          cards,
          seals: sealsAfter,
          brevets: brevetDates,
          records: {
            best: {
              ...state.records.best,
              [key]: Math.max(state.records.best[key] ?? 0, summary.score),
            },
            totalAsked: state.records.totalAsked + summary.asked,
            totalCorrect: state.records.totalCorrect + summary.correct,
            totalSessions: state.records.totalSessions + 1,
            totalPlayTime: state.records.totalPlayTime + summary.duration,
            bestCombo,
          },
          purse: {
            ...state.purse,
            doublons:
              state.purse.doublons + earnings.doublons + payout.doublons + brevets.doublons,
            xp: xpAfter,
          },
          carnet: { dateKey: today, progress: carnetProgress, paid: payout.completed },
        });

        return {
          earnings,
          brevets: brevets.ids,
          brevetDoublons: brevets.doublons,
          carnet: { completed: payout.completed, doublons: payout.doublons },
          xpBefore: state.purse.xp,
          xpAfter,
        };
      },

      completeDaily: (result) =>
        set((state) => {
          if (state.daily.results[result.dateKey]) return state;

          const continues = state.daily.lastCompleted === previousDayKey(result.dateKey);
          const currentStreak = continues ? state.daily.currentStreak + 1 : 1;

          return {
            daily: {
              results: { ...state.daily.results, [result.dateKey]: result },
              currentStreak,
              longestStreak: Math.max(state.daily.longestStreak, currentStreak),
              lastCompleted: result.dateKey,
            },
          };
        }),

      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),

      buyHint: (id, price) => {
        const { purse } = get();
        if (purse.doublons < price) return false;
        set({
          purse: {
            ...purse,
            doublons: purse.doublons - price,
            hints: { ...purse.hints, [id]: (purse.hints[id] ?? 0) + 1 },
          },
        });
        return true;
      },

      useHint: (id) => {
        const { purse } = get();
        const held = purse.hints[id] ?? 0;
        if (held <= 0) return false;
        set({ purse: { ...purse, hints: { ...purse.hints, [id]: held - 1 } } });
        return true;
      },

      buyInk: (id, price) => {
        const { purse } = get();
        if (purse.inks.includes(id) || purse.doublons < price) return false;
        set({ purse: { ...purse, doublons: purse.doublons - price, inks: [...purse.inks, id], ink: id } });
        return true;
      },

      selectInk: (id) =>
        set((state) =>
          state.purse.inks.includes(id) ? { purse: { ...state.purse, ink: id } } : state,
        ),

      resetProgress: () =>
        set({
          cards: {},
          records: emptyRecords(),
          purse: emptyPurse(),
          carnet: emptyCarnet(),
          brevets: {},
          seals: [],
          daily: { results: {}, currentStreak: 0, longestStreak: 0, lastCompleted: null },
        }),
    }),
    {
      name: 'portulan.progress',
      version: 5,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _hydrated, ...rest }) => rest,
      migrate: (persisted, version) => {
        const state = persisted as ProgressState;

        let next = state;
        if (version < 3) {
          const { sound: _sound, ...settings } = (state.settings ?? {}) as Settings & {
            sound?: boolean;
          };
          next = {
            ...next,
            settings: { ...defaultSettings(), ...settings, onboarded: false },
          } as ProgressState;
        }

        if (version < 5) {
          const legacy = (next.settings as unknown as { level?: string })?.level;
          const floor = legacy === 'confirme' ? 4 : legacy === 'notions' ? 2 : 0;
          const { level: _level, ...settings } = (next.settings ?? {}) as Settings & {
            level?: string;
          };
          next = { ...next, settings: { ...defaultSettings(), ...settings, floor } } as ProgressState;
        }

        if (version < 4) {
          const cards = next.cards ?? {};
          const context: BrevetContext = {
            cards,
            xp: 0,
            longestStreak: next.daily?.longestStreak ?? 0,
            bestExpedition: 0,
            floor: next.settings?.floor ?? 0,
            bestCombo: 0,
          };
          const already: Record<string, number> = {};
          const now = Date.now();
          for (const id of newBrevets(context, {}).ids) already[id] = now;

          next = {
            ...next,
            purse: emptyPurse(),
            carnet: emptyCarnet(),
            brevets: already,
            seals: allSeals(cards),
            records: { ...emptyRecords(), ...next.records },
          } as ProgressState;
        }

        return next;
      },
    },
  ),
);

useProgress.persist.onFinishHydration(() => useProgress.setState({ hydrated: true }));
if (useProgress.persist.hasHydrated()) useProgress.setState({ hydrated: true });

export const selectDailyDone = (state: ProgressState, key = dailyKey()): boolean =>
  Boolean(state.daily.results[key]);

export const selectAccuracy = (state: ProgressState): number =>
  state.records.totalAsked === 0 ? 0 : state.records.totalCorrect / state.records.totalAsked;

export const questsOf = (carnet: Carnet, key = dailyKey()) =>
  questsFor(key, carnet.dateKey === key ? carnet.progress : {});

export const selectMasteredLevel = MASTERED_LEVEL;
