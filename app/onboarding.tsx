import { useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import { difficultyTable } from '@/game/difficulty';
import { tap } from '@/fx/haptics';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { AtlasSilhouette } from '@/map/AtlasSilhouette';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { PaperSurface } from '@/ui/PaperSurface';
import { Text } from '@/ui/Text';

const STEPS = 2;

export default function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);

  const [step, setStep] = useState(0);
  const [atlasId, setAtlasId] = useState<AtlasId>(settings.lastAtlas);

  const finish = () => {
    updateSettings({ lastAtlas: atlasId });
    router.replace({ pathname: '/jaugeage', params: { atlas: atlasId } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <LinearGradient
        colors={[theme.colors.surface, theme.colors.canvas]}
        style={{
          flex: 1,
          paddingTop: insets.top + theme.space.md,
          paddingBottom: insets.bottom + theme.space.lg,
          paddingHorizontal: theme.space.lg,
        }}
      >
        <Progress step={step} />

        {step === 0 ? (
          <Hook key="hook" onNext={() => setStep(1)} />
        ) : (
          <PickTerrain
            key="terrain"
            width={width - theme.space.lg * 2}
            value={atlasId}
            onChange={setAtlasId}
            onNext={finish}
          />
        )}
      </LinearGradient>
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
            borderWidth: theme.borderWidth.hair,
            borderColor: i <= step ? theme.colors.reward : theme.colors.borderSoft,
          }}
        />
      ))}
    </View>
  );
}

function Hook({ onNext }: { onNext: () => void }) {
  const theme = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
      <View style={{ flex: 1, marginTop: theme.space.sm }}>
        <MapParade />
      </View>

      <Animated.View entering={FadeInDown.delay(300).duration(420)}>
        <Text variant="cartouche" color="reward">
          Portulan
        </Text>
        <Text variant="displayXL" style={{ marginTop: theme.space.xs }}>
          Retenez la carte.
        </Text>
        <Text variant="note" color="textSecondary" style={{ marginTop: theme.space.xs }}>
          101 départements. 193 pays. Cinq minutes par jour.
        </Text>

      </Animated.View>

      <Button
        label="Commencer"
        size="lg"
        tone="success"
        block
        onPress={onNext}
        style={{ marginTop: theme.space.lg }}
      />
    </Animated.View>
  );
}

function MapParade() {
  const atlas = ATLASES['france-departments'];
  const order = useMemo(() => difficultyTable('france-departments').ordered, []);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setRevealed((current) => (current >= order.length ? 0 : current + 4));
    }, 70);
    return () => clearInterval(timer);
  }, [order.length]);

  const states = useMemo(() => {
    const out: Record<string, TerritoryState> = {};
    for (let i = 0; i < Math.min(revealed, order.length); i++) {
      out[order[i]!.id] = 'mastered';
    }
    return out;
  }, [revealed, order]);

  return (
    <AtlasMap
      atlas={atlas}
      states={states}
      labels="none"
      zoomable={false}
      style={{ flex: 1 }}
    />
  );
}

function PickTerrain({
  width,
  value,
  onChange,
  onNext,
}: {
  width: number;
  value: AtlasId;
  onChange: (id: AtlasId) => void;
  onNext: () => void;
}) {
  const theme = useTheme();

  const options: { id: AtlasId; name: string; detail: string }[] = [
    { id: 'france-departments', name: 'La France', detail: '101 départements et leurs chefs-lieux' },
    { id: 'world-countries', name: 'Le monde', detail: '193 États, capitales et drapeaux' },
  ];

  return (
    <Animated.View entering={FadeInDown.duration(360)} style={{ flex: 1 }}>
      <Text variant="display" style={{ marginTop: theme.space.lg }}>
        Par où commencer ?
      </Text>

      <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.md }}>
        {options.map((option) => (
          <Choice
            key={option.id}
            selected={option.id === value}
            title={option.name}
            detail={option.detail}
            onPress={() => onChange(option.id)}
            illustration={
              <AtlasSilhouette
                atlas={ATLASES[option.id]}
                width={width * 0.24}
                height={72}
                opacity={option.id === value ? 0.34 : 0.14}
              />
            }
          />
        ))}
      </View>

      <Button label="Jauger mon niveau" size="lg" tone="success" block onPress={onNext} />
    </Animated.View>
  );
}

function Choice({
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
    >
      <PaperSurface
        tone={selected ? 'raised' : 'base'}
        radius="lg"
        grain={0.25}
        elevation={selected ? 'lifted' : 'none'}
        style={{
          borderWidth: selected ? theme.borderWidth.thick : theme.borderWidth.hair,
          borderColor: selected ? theme.colors.borderStrong : theme.colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.md,
            padding: theme.space.lg,
            minHeight: theme.hitTarget.comfortable,
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
        </View>
      </PaperSurface>
    </Pressable>
  );
}
