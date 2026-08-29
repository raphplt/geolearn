import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import { rankProgress } from '@/game/economy';
import { currentRung, rungAt, rungProgress } from '@/game/ladder';
import { masteryOf } from '@/game/mastery';
import { plans, recommended, type PlanId } from '@/game/plan';
import { dailyKey } from '@/game/rng';
import { tap } from '@/fx/haptics';
import { AtlasSilhouette } from '@/map/AtlasSilhouette';
import { selectDailyDone, studiedAtlases, useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { EmbarkSheet } from '@/ui/game/EmbarkSheet';
import { useLaunch } from '@/ui/game/useLaunch';
import { ListRow, ListSection } from '@/ui/List';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useNow } from '@/ui/useNow';

const ATLAS_NAME: Record<AtlasId, string> = {
  'france-departments': 'France',
  'world-countries': 'Monde',
};

export default function Cap() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const settings = useProgress((s) => s.settings);
  const daily = useProgress((s) => s.daily);
  const cards = useProgress((s) => s.cards);
  const purse = useProgress((s) => s.purse);
  const updateSettings = useProgress((s) => s.updateSettings);

  const atlasId = settings.lastAtlas;
  const atlas = ATLASES[atlasId];
  const floors = settings.floors;
  const studying = useMemo(() => studiedAtlases(settings), [settings]);
  const floor = floors[atlasId] ?? 0;
  const dailyDone = useProgress((s) => selectDailyDone(s, dailyKey()));

  const resumable = useSession((s) => s.resumable);
  const resume = useSession((s) => s.resume);
  const dropResumable = useSession((s) => s.dropResumable);
  const launch = useLaunch();

  const now = useNow();

  const [embarking, setEmbarking] = useState(false);
  const [logbook, setLogbook] = useState(false);
  const [choice, setChoice] = useState<PlanId | null>(null);

  const input = useMemo(
    () => ({ atlasId, cards, floor, dailyDone, now }),
    [atlasId, cards, floor, dailyDone, now],
  );

  /* The atlas on screen first, so a tie resolves in favour of what you see. */
  const inputs = useMemo(
    () =>
      studying.map((id) => ({
        atlasId: id,
        cards,
        floor: floors[id] ?? 0,
        dailyDone,
        now,
      })),
    [studying, cards, floors, dailyDone, now],
  );

  const advice = useMemo(() => recommended(inputs), [inputs]);
  const elsewhere = advice.atlasId !== atlasId;

  /* The logbook counts across every atlas being learnt, not just the one shown. */
  const revisions = useMemo(
    () => inputs.map((i) => plans(i)[0]!).sort((a, b) => b.count - a.count),
    [inputs],
  );
  const dueNow = revisions.reduce((sum, plan) => sum + plan.count, 0);
  const mastery = useMemo(() => masteryOf(cards, atlasId), [cards, atlasId]);
  const rungIndex = useMemo(() => currentRung(atlasId, cards, floor), [atlasId, cards, floor]);
  const rung = rungAt(atlasId, rungIndex);
  const progress = useMemo(
    () => rungProgress(atlasId, cards, rungIndex),
    [atlasId, cards, rungIndex],
  );
  const rank = rankProgress(purse.xp);

  const resumeLabel =
    resumable?.config.mode === 'expedition' ? 'Reprendre l’expédition' : 'Reprendre la partie';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <RankLine
        name={rank.current.name}
        ratio={rank.ratio}
        onPress={() => {
          tap();
          setLogbook(true);
        }}
      />

      <View style={{ flex: 1, paddingHorizontal: theme.space.xl }}>
        <View style={{ flex: 1, justifyContent: 'center' }} pointerEvents="none">
          <AtlasSilhouette atlas={atlas} opacity={0.22} />
        </View>

        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <Text variant="cartouche" color="textTertiary">
            {ATLAS_NAME[atlasId]}
          </Text>
          <Text variant="display">{rung.name}</Text>
          <View
            style={{
              width: Math.min(width * 0.5, 220),
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.colors.surfaceSunk,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(progress.ratio * 100, progress.ratio > 0 ? 4 : 0)}%`,
                height: '100%',
                backgroundColor: theme.colors.success,
              }}
            />
          </View>
          <Text variant="caption" color="textTertiary" align="center">
            {mastery.mastered} / {mastery.total} en mémoire longue
          </Text>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: theme.space.xl,
          paddingBottom: theme.space.lg,
          gap: theme.space.sm,
        }}
      >
        {resumable ? (
          <>
            <Button
              label={resumeLabel}
              detail={`${resumable.answers.length} question${resumable.answers.length > 1 ? 's' : ''} déjà posée${resumable.answers.length > 1 ? 's' : ''}`}
              size="lg"
              tone="danger"
              block
              onPress={() => {
                if (resume()) router.push('/play');
              }}
            />
            <Quiet
              label="Repartir de zéro"
              onPress={() => {
                dropResumable();
              }}
            />
          </>
        ) : (
          <>
            <Button
              label={advice.action}
              detail={
                elsewhere
                  ? `${ATLAS_NAME[advice.atlasId]} · ${advice.title} · ${advice.duration}`
                  : `${advice.title} · ${advice.duration}`
              }
              size="lg"
              tone={advice.id === 'expedition' ? 'danger' : 'success'}
              block
              onPress={() => launch(advice.atlasId, advice.id)}
            />
            <Quiet
              label="Choisir autre chose"
              onPress={() => {
                setChoice(advice.id);
                setEmbarking(true);
              }}
            />
          </>
        )}
      </View>

      <EmbarkSheet
        visible={embarking}
        onClose={() => setEmbarking(false)}
        atlasId={atlasId}
        atlases={studying}
        onAtlas={(id) => updateSettings({ lastAtlas: id })}
        selected={choice ?? advice.id}
        onSelect={setChoice}
        input={input}
        onLaunch={(plan) => {
          setEmbarking(false);
          launch(atlasId, plan.id);
        }}
      />

      <Sheet
        visible={logbook}
        onClose={() => setLogbook(false)}
        eyebrow={rank.current.name}
        title="Carnet de bord"
      >
        <ListSection style={{ paddingTop: theme.space.md }}>
          <ListRow first title="Doublons" meta={`${purse.doublons}`} />
          <ListRow title="Expérience" meta={`${purse.xp}`} />
          <ListRow
            title="Prochain rang"
            detail={rank.next ? rank.next.name : 'Amirauté atteinte'}
            meta={rank.next ? `${rank.next.at - purse.xp} xp` : '—'}
          />
          <ListRow
            title="Territoires en mémoire longue"
            meta={`${mastery.mastered} / ${mastery.total}`}
          />
          <ListRow title="Série quotidienne" meta={`${daily.currentStreak} j`} />
          <ListRow
            title="Prochaines révisions"
            meta={`${dueNow}`}
            chevron
            onPress={() => {
              setLogbook(false);
              launch(revisions[0]!.atlasId, 'revision');
            }}
            disabled={dueNow === 0}
          />
        </ListSection>
      </Sheet>
    </View>
  );
}

/**
 * The old HUD read as a dashboard: three unexplained icons over the horizon.
 * One named line remains; everything it summarised lives one tap away.
 */
function RankLine({ name, ratio, onPress }: { name: string; ratio: number; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. Ouvrir le carnet de bord`}
      style={{
        marginTop: theme.space.sm,
        marginHorizontal: theme.space.xl,
        minHeight: theme.hitTarget.min,
        justifyContent: 'center',
        gap: 5,
      }}
    >
      <Text variant="labelSm" color="textSecondary">
        {name}
      </Text>
      <View
        style={{
          height: 3,
          borderRadius: 2,
          backgroundColor: theme.colors.surfaceSunk,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(ratio * 100, ratio > 0 ? 3 : 0)}%`,
            height: '100%',
            backgroundColor: theme.colors.info,
          }}
        />
      </View>
    </Pressable>
  );
}

function Quiet({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: theme.hitTarget.min,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="labelSm" color="textSecondary">
        {label}
      </Text>
    </Pressable>
  );
}
