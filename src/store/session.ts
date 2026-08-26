/**
 * Partie en cours — état volatil, jamais persisté.
 *
 * Séparé de `progress` à dessein : une partie interrompue ne doit pas
 * ressusciter au lancement suivant avec un chronomètre expiré depuis trois
 * jours. Ce magasin sert de passe-plat entre l'écran de jeu et l'écran de
 * bilan, que l'on ne peut pas relier par de simples paramètres de route sans
 * sérialiser tout l'historique des réponses dans l'URL.
 */
import { create } from 'zustand';

import {
  answer as applyAnswer,
  expire as applyExpire,
  startSession,
  summarize,
  type SessionConfig,
  type SessionState,
  type SessionSummary,
} from '@/game/session';

type SessionStore = {
  session: SessionState | null;
  /** Bilan figé à la fin de la partie, conservé pour l'écran de résultats. */
  summary: SessionSummary | null;
  start: (config: SessionConfig) => void;
  answer: (chosenId: string | null) => SessionState | null;
  expire: () => void;
  clear: () => void;
};

export const useSession = create<SessionStore>((set, get) => ({
  session: null,
  summary: null,

  start: (config) => {
    const now = Date.now();
    set({ session: startSession(config, now), summary: null });
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

  clear: () => set({ session: null, summary: null }),
}));
