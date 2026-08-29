import { useCallback } from 'react';
import { router } from 'expo-router';

import { ATLASES, type AtlasId } from '@/data';
import { probe } from '@/fx/probe';
import { currentRung } from '@/game/ladder';
import type { PlanId } from '@/game/plan';
import { dueQueue, REVISION_BATCH } from '@/game/revision';
import { dailyKey, seedFrom } from '@/game/rng';
import { dailyConfig, expeditionConfig, lessonConfig } from '@/game/session';
import { warmHitIndex } from '@/map/geometry';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';

/**
 * Everything a session needs is built here, synchronously, before the screen
 * transition starts. The play screen therefore opens on a real question rather
 * than on a spinner: there is no artificial minimum, and no interaction fence.
 */
export function useLaunch() {
  const cards = useProgress((s) => s.cards);
  const floors = useProgress((s) => s.settings.floors);
  const updateSettings = useProgress((s) => s.updateSettings);
  const start = useSession((s) => s.start);

  return useCallback(
    (atlasId: AtlasId, plan: PlanId) => {
      /* Playing an atlas brings it to the front: the Cap follows what you play. */
      updateSettings({ lastAtlas: atlasId });

      if (plan === 'discovery') {
        router.push('/decouverte');
        return;
      }

      const rung = currentRung(atlasId, cards, floors[atlasId] ?? 0);

      const config =
        plan === 'revision'
          ? lessonConfig(
              atlasId,
              seedFrom(`revision:${atlasId}:${Date.now()}`),
              rung,
              dueQueue(cards, atlasId, Date.now(), REVISION_BATCH).map((d) => d.cardId),
            )
          : plan === 'daily'
            ? dailyConfig(atlasId, seedFrom(`daily:${dailyKey()}:${atlasId}`))
            : expeditionConfig(atlasId, seedFrom(`${atlasId}:${Date.now()}`), rung);

      /* Decoding the atlas outlines takes tens of milliseconds; start now. */
      if (config.skills.includes('locate')) warmHitIndex(ATLASES[atlasId]);

      probe.span(`session:build:${plan}`, () => start(config));
      router.push('/play');
    },
    [cards, floors, start, updateSettings],
  );
}
