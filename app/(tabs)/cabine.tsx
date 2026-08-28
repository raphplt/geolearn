import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { ATLASES } from '@/data';
import { FLAG_ATTRIBUTION } from '@/data/flags';
import { currentRung, rungAt } from '@/game/ladder';
import { masteryOf } from '@/game/mastery';
import { tap } from '@/fx/haptics';
import { selectAccuracy, useProgress } from '@/store/progress';
import { useTheme, type SchemePreference } from '@/theme';
import { Hud, type HudChip } from '@/ui/Hud';
import { IconAtlas, IconCabine, IconHourglass } from '@/ui/icons';
import { Text } from '@/ui/Text';
import { Toggle } from '@/ui/Toggle';

const SCHEMES: { value: SchemePreference; label: string }[] = [
  { value: 'light', label: 'Jour' },
  { value: 'dark', label: 'Nuit' },
  { value: 'system', label: 'Auto' },
];

export default function Cabine() {
  const theme = useTheme();

  const settings = useProgress((s) => s.settings);
  const records = useProgress((s) => s.records);
  const daily = useProgress((s) => s.daily);
  const cards = useProgress((s) => s.cards);
  const accuracy = useProgress(selectAccuracy);
  const updateSettings = useProgress((s) => s.updateSettings);
  const resetProgress = useProgress((s) => s.resetProgress);

  const atlasId = settings.lastAtlas;
  const rung = rungAt(atlasId, currentRung(atlasId, cards, settings.floor));

  const chips: HudChip[] = [
    { key: 'sessions', value: `${records.totalSessions}`, tone: 'text', icon: IconCabine },
    {
      key: 'time',
      value: formatPlayTime(records.totalPlayTime),
      tone: 'reward',
      icon: IconHourglass,
    },
    {
      key: 'accuracy',
      value: records.totalAsked > 0 ? `${Math.round(accuracy * 100)} %` : '—',
      tone: 'success',
      icon: IconAtlas,
    },
  ];

  const confirmReset = () => {
    tap();
    const learned =
      masteryOf(cards, 'france-departments', ATLASES['france-departments']).started +
      masteryOf(cards, 'world-countries', ATLASES['world-countries']).started;

    Alert.alert(
      'Tout effacer ?',
      learned > 0
        ? `${learned} territoires, ${records.totalSessions} parties et ${daily.currentStreak} jours de série seront perdus.`
        : 'Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Effacer', style: 'destructive', onPress: () => resetProgress() },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <Hud chips={chips} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.xl,
          paddingTop: theme.space.lg,
          paddingBottom: theme.space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Segmented
          label="Thème"
          options={SCHEMES}
          value={settings.scheme}
          onChange={(scheme) => updateSettings({ scheme })}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: theme.hitTarget.comfortable,
            marginTop: theme.space.xl,
          }}
        >
          <Text variant="label" style={{ flex: 1 }}>
            Retour haptique
          </Text>
          <Toggle
            value={settings.haptics}
            onChange={(haptics) => updateSettings({ haptics })}
            label="Retour haptique"
          />
        </View>

        <Text variant="cartouche" color="textTertiary" style={{ marginTop: theme.space.xl }}>
          Niveau · {rung.name}
        </Text>
        <Action
          label="Refaire le jaugeage"
          onPress={() => {
            tap();
            router.push({ pathname: '/jaugeage', params: { from: 'cabine' } });
          }}
        />

        <Action
          label="Revoir la présentation"
          onPress={() => {
            tap();
            updateSettings({ onboarded: false });
            router.replace('/onboarding');
          }}
        />
        <Action label="Effacer la progression" tone="danger" onPress={confirmReset} />

        <Text variant="caption" color="textQuiet" style={{ marginTop: theme.space.xxl }}>
          {ATLASES['france-departments'].attribution}
        </Text>
        <Text variant="caption" color="textQuiet" style={{ marginTop: theme.space.sm }}>
          {ATLASES['world-countries'].attribution}
        </Text>
        <Text variant="caption" color="textQuiet" style={{ marginTop: theme.space.sm }}>
          {FLAG_ATTRIBUTION}
        </Text>
      </ScrollView>
    </View>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  style,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  style?: object;
}) {
  const theme = useTheme();

  return (
    <View style={style}>
      <Text variant="cartouche" color="textTertiary" style={{ marginBottom: theme.space.sm }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          padding: 3,
          gap: 3,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceSunk,
        }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                tap();
                onChange(option.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                minHeight: theme.hitTarget.min - 6,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.sm,
                backgroundColor: selected ? theme.colors.surfaceRaised : 'transparent',
              }}
            >
              <Text variant="label" color={selected ? 'text' : 'textTertiary'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Action({
  label,
  tone = 'info',
  onPress,
}: {
  label: string;
  tone?: 'info' | 'danger';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: theme.hitTarget.comfortable,
        justifyContent: 'center',
        marginTop: theme.space.md,
      }}
    >
      <Text variant="label" color={tone}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatPlayTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}
