import * as Haptics from 'expo-haptics';

let enabled = true;

export const setHapticsEnabled = (value: boolean): void => {
  enabled = value;
};

const guard = (run: () => Promise<unknown>): void => {
  if (!enabled) return;
  void run().catch(() => {});
};

export const tap = (): void => guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

export const success = (): void =>
  guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export const failure = (): void =>
  guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

export const milestone = (): void =>
  guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
