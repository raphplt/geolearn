/**
 * Progression du joueur — persistée localement, sans compte.
 *
 * La v1 n'a ni serveur ni identité : tout ce que le joueur accumule vit dans le
 * stockage de l'appareil. Deux conséquences assumées dans la conception :
 *
 *  · Le format est **versionné et migré**. Une progression de plusieurs mois ne
 *    peut pas être perdue parce qu'un champ a changé de nom ; `migrate` est
 *    l'endroit qui garantit qu'une mise à jour ne remet jamais un joueur à zéro.
 *
 *  · Les cartes de révision sont indexées par identifiant stable
 *    (`atlas:territoire:compétence`), et non par position : réordonner un atlas
 *    ou en ajouter un ne dérange rien.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AtlasId } from '@/data';
import { dailyKey } from '@/game/rng';
import { createCard, review, type Card, type CardId } from '@/game/srs';
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
  sound: boolean;
  /** Atlas proposé par défaut à l'ouverture. */
  lastAtlas: AtlasId;
};

export type Records = {
  /** Meilleur score par atlas et par mode, clef `atlas:mode`. */
  best: Record<string, number>;
  totalAsked: number;
  totalCorrect: number;
  totalSessions: number;
  /** Temps de jeu cumulé, en millisecondes. */
  totalPlayTime: number;
};

type ProgressState = {
  cards: Record<CardId, Card>;
  records: Records;
  daily: {
    /** Résultats indexés par date locale (`AAAA-MM-JJ`). */
    results: Record<string, DailyResult>;
    currentStreak: number;
    longestStreak: number;
    lastCompleted: string | null;
  };
  settings: Settings;
  hydrated: boolean;

  reviewCard: (cardId: CardId, correct: boolean, elapsed: number, now?: number) => void;
  recordSession: (state: SessionState, summary: SessionSummary, now?: number) => void;
  completeDaily: (result: DailyResult, now?: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetProgress: () => void;
};

const emptyRecords = (): Records => ({
  best: {},
  totalAsked: 0,
  totalCorrect: 0,
  totalSessions: 0,
  totalPlayTime: 0,
});

const defaultSettings = (): Settings => ({
  scheme: 'system',
  haptics: true,
  sound: true,
  lastAtlas: 'france-departments',
});

export const recordKey = (atlasId: AtlasId, mode: SessionMode): string => `${atlasId}:${mode}`;

/** Veille du jour donné, au format de clé quotidienne — sert au calcul des séries. */
function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() - 1);
  return dailyKey(date);
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      cards: {},
      records: emptyRecords(),
      daily: { results: {}, currentStreak: 0, longestStreak: 0, lastCompleted: null },
      settings: defaultSettings(),
      hydrated: false,

      reviewCard: (cardId, correct, elapsed, now = Date.now()) =>
        set((state) => {
          const existing = state.cards[cardId] ?? createCard(cardId, now);
          return {
            cards: { ...state.cards, [cardId]: review(existing, { correct, elapsed }, now) },
          };
        }),

      recordSession: (session, summary, now = Date.now()) => {
        /* Les cartes sont mises à jour d'abord, une par une : c'est la
           progression réelle du joueur, indépendante du score affiché. */
        for (const a of session.answers) {
          get().reviewCard(a.cardId, a.correct, a.elapsed, now);
        }

        set((state) => {
          const key = recordKey(session.config.atlasId, session.config.mode);
          return {
            records: {
              best: {
                ...state.records.best,
                [key]: Math.max(state.records.best[key] ?? 0, summary.score),
              },
              totalAsked: state.records.totalAsked + summary.asked,
              totalCorrect: state.records.totalCorrect + summary.correct,
              totalSessions: state.records.totalSessions + 1,
              totalPlayTime: state.records.totalPlayTime + summary.duration,
            },
          };
        });
      },

      completeDaily: (result) =>
        set((state) => {
          /* Rejouer un relevé déjà terminé ne doit ni gonfler la série ni
             écraser le résultat : le relevé du jour n'a qu'une seule prise. */
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

      resetProgress: () =>
        set({
          cards: {},
          records: emptyRecords(),
          daily: { results: {}, currentStreak: 0, longestStreak: 0, lastCompleted: null },
        }),
    }),
    {
      name: 'portulan.progress',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      /* `hydrated` décrit l'état du chargement, pas la progression : le persister
         ferait démarrer l'application en se croyant déjà chargée. */
      partialize: ({ hydrated: _hydrated, ...rest }) => rest,
      migrate: (persisted, version) => {
        /* Aucune migration à ce jour ; le point d'entrée existe pour que la
           première évolution de schéma n'ait pas à réinventer ce câblage. */
        void version;
        return persisted as ProgressState;
      },
    },
  ),
);

/*
 * Fanion de chargement.
 *
 * L'interface ne doit rien peindre avant que la progression soit relue : afficher
 * « série : 0 » puis « série : 12 » un instant plus tard donne l'impression que
 * l'application a perdu les données du joueur. On s'abonne à la fin de
 * réhydratation, **et** on teste `hasHydrated()` dans la foulée : sur un
 * stockage rapide, la réhydratation peut être terminée avant même que l'abonnement
 * soit posé, auquel cas l'événement ne se déclencherait jamais.
 */
useProgress.persist.onFinishHydration(() => useProgress.setState({ hydrated: true }));
if (useProgress.persist.hasHydrated()) useProgress.setState({ hydrated: true });

/* ───────────────────────── Sélecteurs ───────────────────────── */

export const selectDailyDone = (state: ProgressState, key = dailyKey()): boolean =>
  Boolean(state.daily.results[key]);

export const selectAccuracy = (state: ProgressState): number =>
  state.records.totalAsked === 0 ? 0 : state.records.totalCorrect / state.records.totalAsked;
