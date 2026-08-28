import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import type { Country, Department, Territory } from '@/data/types';
import { currentRung, undiscovered } from '@/game/ladder';
import { seedFrom } from '@/game/rng';
import { discoveryConfig, DISCOVERY_BATCH } from '@/game/session';
import { tap } from '@/fx/haptics';
import { AtlasMap } from '@/map/AtlasMap';
import { focusFrame } from '@/map/framing';
import { useProgress } from '@/store/progress';
import { useSession } from '@/store/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Flag } from '@/ui/Flag';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

export default function Decouverte() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const settings = useProgress((s) => s.settings);
  const cards = useProgress((s) => s.cards);
  const prepare = useSession((s) => s.prepare);

  const atlasId = settings.lastAtlas;
  const atlas = ATLASES[atlasId];

  const rungIndex = useMemo(
    () => currentRung(atlasId, cards, settings.floor),
    [atlasId, cards, settings.floor],
  );

  const [batch] = useState<Territory[]>(() =>
    undiscovered(atlasId, cards, rungIndex).slice(0, DISCOVERY_BATCH),
  );

  const [index, setIndex] = useState(0);
  const territory = batch[index];

  const quit = () => {
    tap();
    router.replace('/');
  };

  const verify = () => {
    prepare(
      discoveryConfig(
        atlasId,
        seedFrom(`discovery:${atlasId}:${batch.map((t) => t.id).join(',')}`),
        rungIndex,
        batch.map((t) => t.id),
      ),
    );
    router.replace('/play');
  };

  if (!territory) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.space.xl,
          gap: theme.space.lg,
        }}
      >
        <Text variant="title" align="center">
          Tout le palier a été rencontré
        </Text>
        <Button label="Revenir au port" variant="secondary" onPress={quit} />
      </View>
    );
  }

  const last = index === batch.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.md,
          paddingHorizontal: theme.space.lg,
          minHeight: theme.hitTarget.comfortable,
        }}
      >
        <Text variant="cartouche" color="textTertiary">
          Découverte
        </Text>
        <View style={{ flexDirection: 'row', gap: 5, flex: 1 }}>
          {batch.map((t, i) => (
            <View
              key={t.id}
              style={{
                width: i === index ? 18 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor:
                  i <= index ? theme.colors.success : theme.colors.surfaceSunk,
                borderWidth: theme.borderWidth.hair,
                borderColor: i <= index ? theme.colors.success : theme.colors.borderSoft,
              }}
            />
          ))}
        </View>
        <Pressable onPress={quit} hitSlop={12} accessibilityRole="button" accessibilityLabel="Quitter">
          <Text variant="labelSm" color="textSecondary">
            Quitter
          </Text>
        </Pressable>
      </View>

      <Animated.View
        key={territory.id}
        entering={SlideInRight.duration(260)}
        exiting={SlideOutLeft.duration(180)}
        style={{ flex: 1, paddingHorizontal: theme.space.lg, gap: theme.space.md }}
      >
        <AtlasMap
          atlas={atlas}
          states={{ [territory.id]: 'target' }}
          viewBox={focusFrame(atlas, territory.id)}
          labels="none"
          zoomable={false}
          style={{ flex: 1 }}
        />

        <Fiche atlasId={atlasId} territory={territory} />
      </Animated.View>

      <View
        style={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: insets.bottom + theme.space.lg,
          paddingTop: theme.space.md,
        }}
      >
        <Button
          label={last ? `Vérifier ces ${batch.length}` : 'Suivant'}
          size="lg"
          tone="success"
          block
          onPress={() => {
            tap();
            if (last) verify();
            else setIndex((i) => i + 1);
          }}
        />
      </View>
    </View>
  );
}

function Fiche({ atlasId, territory }: { atlasId: AtlasId; territory: Territory }) {
  const theme = useTheme();
  const isFrance = atlasId === 'france-departments';
  const dept = isFrance ? (territory as Department) : null;
  const country = isFrance ? null : (territory as Country);

  return (
    <Animated.View entering={FadeIn.delay(120).duration(300)}>
      <PaperSurface
        tone="raised"
        bordered
        radius="lg"
        grain={0.3}
        elevation="lifted"
        style={{ padding: theme.space.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          {country ? (
            <Flag cca2={country.cca2} height={40} label={country.name} />
          ) : dept ? (
            <View
              style={{
                minWidth: 48,
                paddingHorizontal: theme.space.sm,
                paddingVertical: theme.space.xs,
                borderRadius: theme.radius.sm,
                alignItems: 'center',
                backgroundColor: theme.colors.surfaceSunk,
                borderWidth: theme.borderWidth.hair,
                borderColor: theme.colors.border,
              }}
            >
              <Text variant="numeral" tabular>
                {dept.id}
              </Text>
            </View>
          ) : null}

          <Text variant="titleLg" style={{ flex: 1 }} numberOfLines={2}>
            {territory.name}
          </Text>
        </View>

        <View style={{ marginTop: theme.space.md, gap: theme.space.xs }}>
          <Line
            label={isFrance ? 'Chef-lieu' : 'Capitale'}
            value={dept?.prefecture ?? country?.capital ?? '—'}
          />
          <Line
            label={isFrance ? 'Région' : 'Sous-région'}
            value={dept?.region ?? country?.subregion ?? '—'}
          />
          {country ? (
            <Line label="Population" value={formatPopulation(country.population)} />
          ) : null}
        </View>
      </PaperSurface>
    </Animated.View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space.md }}>
      <Text variant="caption" color="textTertiary" style={{ width: 92 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatPopulation(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 100 ? Math.round(millions) : millions.toFixed(1).replace('.', ',')} millions`;
  }
  return `${Math.round(value / 1000)} 000`;
}
