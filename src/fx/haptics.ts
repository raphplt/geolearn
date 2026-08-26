/**
 * Retours haptiques.
 *
 * Enveloppés dans un module dédié pour deux raisons : le joueur doit pouvoir
 * tout couper d'un réglage, et `expo-haptics` échoue silencieusement sur les
 * appareils sans moteur haptique — ce qui est acceptable, mais qu'on ne veut
 * surtout pas voir remonter sous forme de promesse rejetée non gérée.
 */
import * as Haptics from 'expo-haptics';

let enabled = true;

export const setHapticsEnabled = (value: boolean): void => {
  enabled = value;
};

const guard = (run: () => Promise<unknown>): void => {
  if (!enabled) return;
  void run().catch(() => {
    /* Appareil sans retour haptique : l'absence de vibration n'est pas une erreur. */
  });
};

/** Toucher d'interface courant — bouton, sélection. */
export const tap = (): void =>
  guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Bonne réponse. */
export const success = (): void =>
  guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Mauvaise réponse. */
export const failure = (): void =>
  guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

/** Franchissement d'un palier de série — plus appuyé que le toucher courant. */
export const milestone = (): void =>
  guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
