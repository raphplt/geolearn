import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import { difficultyTable } from '@/game/difficulty';
import { tap } from '@/fx/haptics';
import { AtlasReveal } from '@/map/AtlasReveal';
import { AtlasSilhouette } from '@/map/AtlasSilhouette';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

const STEPS = 2;

type Choice = 'france' | 'world' | 'both';

const ATLASES_OF: Record<Choice, AtlasId[]> = {
  france: ['france-departments'],
  world: ['world-countries'],
  both: ['france-departments', 'world-countries'],
};

export default function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);

  const setStudying = useProgress((s) => s.setStudying);

  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<Choice>(
    settings.lastAtlas === 'world-countries' ? 'world' : 'france',
  );

  const finish = () => {
    const studying = ATLASES_OF[choice];
    setStudying(studying);
    updateSettings({ lastAtlas: studying[0]! });
    router.replace({
      pathname: '/jaugeage',
      params: { atlas: studying[0]!, ...(studying[1] ? { then: studying[1] } : null) },
    });
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.canvas,
        paddingTop: insets.top + theme.space.md,
        paddingBottom: insets.bottom + theme.space.lg,
        paddingHorizontal: theme.space.lg,
      }}
    >
      <Progress step={step} />

      {step === 0 ? (
        <Hook onNext={() => setStep(1)} />
      ) : (
        <PickTerrain
          width={width - theme.space.lg * 2}
          value={choice}
          onChange={setChoice}
          onNext={finish}
        />
      )}
    </View>
  );
}

function Progress({ step }: { step: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        paddingVertical: theme.space.sm,
      }}
    >
      {Array.from({ length: STEPS }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === step ? 20 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: i <= step ? theme.colors.reward : theme.colors.surfaceSunk,
          }}
        />
      ))}
    </View>
  );
}

function Hook({ onNext }: { onNext: () => void }) {
  const theme = useTheme();

  /* The map fills in from the departments everyone knows to the ones nobody does. */
  const order = useMemo(() => difficultyTable('france-departments').ordered.map((t) => t.id), []);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, marginTop: theme.space.sm }}>
        <AtlasReveal atlas={ATLASES['france-departments']} order={order} />
      </View>

      <Text variant="displayXL" style={{ marginTop: theme.space.lg }}>
        Retenez la carte.
      </Text>
      <Text variant="note" color="textSecondary" style={{ marginTop: theme.space.xs }}>
        101 départements. 193 pays. Cinq minutes par jour.
      </Text>

      <Button
        label="Commencer"
        size="lg"
        tone="success"
        block
        onPress={onNext}
        style={{ marginTop: theme.space.lg }}
      />
    </View>
  );
}

function PickTerrain({
  width,
  value,
  onChange,
  onNext,
}: {
  width: number;
  value: Choice;
  onChange: (choice: Choice) => void;
  onNext: () => void;
}) {
  const theme = useTheme();

  const options: { id: Choice; name: string; detail: string }[] = [
    {
      id: 'france',
      name: 'La France',
      detail: '101 départements, leurs numéros et leurs chefs-lieux',
    },
    {
      id: 'world',
      name: 'Le monde',
      detail: '193 États, capitales et drapeaux',
    },
    {
      id: 'both',
      name: 'Les deux',
      detail: 'Une seule file de révision, un niveau par atlas',
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Text variant="display" style={{ marginTop: theme.space.lg }}>
        Par où commencer ?
      </Text>
      <Text variant="note" color="textSecondary" style={{ marginTop: theme.space.xs }}>
        Rien n’est définitif : cela se change dans la Cabine.
      </Text>

      <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.sm }}>
        {options.map((option) => (
          <Pick
            key={option.id}
            selected={option.id === value}
            title={option.name}
            detail={option.detail}
            onPress={() => onChange(option.id)}
            illustration={
              option.id === 'both' ? (
                <View style={{ flexDirection: 'row', width: width * 0.22 }}>
                  {ATLASES_OF.both.map((id) => (
                    <AtlasSilhouette
                      key={id}
                      atlas={ATLASES[id]}
                      width={width * 0.11}
                      height={58}
                      opacity={value === 'both' ? 0.34 : 0.14}
                    />
                  ))}
                </View>
              ) : (
                <AtlasSilhouette
                  atlas={ATLASES[ATLASES_OF[option.id][0]!]}
                  width={width * 0.22}
                  height={58}
                  opacity={option.id === value ? 0.34 : 0.14}
                />
              )
            }
          />
        ))}
      </View>

      <Button label="Jauger mon niveau" size="lg" tone="success" block onPress={onNext} />
    </View>
  );
}

function Pick({
  selected,
  title,
  detail,
  illustration,
  onPress,
}: {
  selected: boolean;
  title: string;
  detail: string;
  illustration?: React.ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${detail}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        padding: theme.space.lg,
        minHeight: theme.hitTarget.comfortable,
        borderRadius: theme.radius.lg,
        backgroundColor: selected ? theme.colors.surfaceRaised : 'transparent',
        borderWidth: selected ? theme.borderWidth.thick : theme.borderWidth.hair,
        borderColor: selected ? theme.colors.borderStrong : theme.colors.border,
      }}
    >
      {illustration}
      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        <Text variant="caption" color="textSecondary" style={{ marginTop: theme.space.xxs }}>
          {detail}
        </Text>
      </View>

      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? theme.colors.success : 'transparent',
          borderWidth: theme.borderWidth.thin,
          borderColor: selected ? theme.colors.success : theme.colors.border,
        }}
      >
        {selected ? (
          <Text variant="labelSm" color="textOnAccent">
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
