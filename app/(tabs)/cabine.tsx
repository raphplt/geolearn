import { Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import { currentRung, MAX_RUNG, rungAt } from '@/game/ladder';
import { masteryOf } from '@/game/mastery';
import { tap } from '@/fx/haptics';
import { selectAccuracy, useProgress } from '@/store/progress';
import { useTheme, type SchemePreference } from '@/theme';
import { ListRow, ListSection, ListSwitch } from '@/ui/List';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';

const SCHEMES: { value: SchemePreference; label: string }[] = [
  { value: 'light', label: 'Jour' },
  { value: 'dark', label: 'Nuit' },
  { value: 'system', label: 'Auto' },
];

const ATLAS_NAME: Record<AtlasId, string> = {
  'france-departments': 'France',
  'world-countries': 'Monde',
};

const ATLAS_DETAIL: Record<AtlasId, string> = {
  'france-departments': '101 départements, leurs numéros et leurs chefs-lieux',
  'world-countries': '193 États, capitales et drapeaux',
};

export default function Cabine() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const settings = useProgress((s) => s.settings);
  const records = useProgress((s) => s.records);
  const daily = useProgress((s) => s.daily);
  const cards = useProgress((s) => s.cards);
  const accuracy = useProgress(selectAccuracy);
  const updateSettings = useProgress((s) => s.updateSettings);
  const setStudying = useProgress((s) => s.setStudying);
  const resetProgress = useProgress((s) => s.resetProgress);

  const studying = settings.studying;

  const confirmReset = () => {
    const learned =
      masteryOf(cards, 'france-departments').started + masteryOf(cards, 'world-countries').started;

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
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas, paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: theme.space.lg,
          minHeight: theme.hitTarget.comfortable,
          justifyContent: 'center',
        }}
      >
        <Text variant="title">Cabine</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: theme.space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <ListSection title="Affichage" style={{ marginTop: theme.space.md }}>
          <View
            style={{
              paddingHorizontal: theme.space.lg,
              paddingVertical: theme.space.sm,
            }}
          >
            <Segmented
              options={SCHEMES}
              value={settings.scheme}
              onChange={(scheme) => updateSettings({ scheme })}
              accessibilityLabel="Thème"
            />
          </View>
          <ListSwitch
            title="Retour haptique"
            detail="Une vibration courte à la réponse, à la série et à l’avarie."
            value={settings.haptics}
            onChange={(haptics) => updateSettings({ haptics })}
          />
        </ListSection>

        <ListSection
          title="Ce que vous apprenez"
          footer="Les deux atlas partagent une seule file de révision : ce qui s’efface passe devant, quel que soit l’atlas."
          style={{ marginTop: theme.space.xl }}
        >
          {(Object.keys(ATLASES) as AtlasId[]).map((atlasId, i) => {
            const on = studying.includes(atlasId);
            return (
              <ListSwitch
                key={atlasId}
                first={i === 0}
                title={ATLAS_NAME[atlasId]}
                detail={
                  on && studying.length === 1
                    ? 'Le seul atlas en cours : il ne peut pas être retiré'
                    : ATLAS_DETAIL[atlasId]
                }
                value={on}
                onChange={(next) =>
                  setStudying(
                    next ? [...studying, atlasId] : studying.filter((id) => id !== atlasId),
                  )
                }
              />
            );
          })}
        </ListSection>

        <ListSection
          title="Niveau de départ"
          footer="Chaque atlas a son propre niveau : on peut être aguerri sur la France et débutant sur le monde."
          style={{ marginTop: theme.space.xl }}
        >
          {(Object.keys(ATLASES) as AtlasId[])
            .filter((id) => studying.includes(id))
            .map((atlasId, i) => {
              const floor = settings.floors[atlasId] ?? 0;
              const rung = rungAt(atlasId, currentRung(atlasId, cards, floor));
              return (
                <ListRow
                  key={atlasId}
                  first={i === 0}
                  title={ATLAS_NAME[atlasId]}
                  detail={rung.motto}
                  meta={`${rung.index + 1}/${MAX_RUNG + 1}`}
                  chevron
                  onPress={() =>
                    router.push({
                      pathname: '/jaugeage',
                      params: { atlas: atlasId, from: 'cabine' },
                    })
                  }
                />
              );
            })}
        </ListSection>

        <ListSection title="Vos relevés" style={{ marginTop: theme.space.xl }}>
          <ListRow first title="Parties jouées" meta={`${records.totalSessions}`} />
          <ListRow title="Temps passé" meta={formatPlayTime(records.totalPlayTime)} />
          <ListRow
            title="Précision d’ensemble"
            meta={records.totalAsked > 0 ? `${Math.round(accuracy * 100)} %` : '—'}
          />
          <ListRow title="Plus longue série quotidienne" meta={`${daily.longestStreak} j`} />
        </ListSection>

        <ListSection title="À propos" style={{ marginTop: theme.space.xl }}>
          <ListRow
            first
            title="Revoir la présentation"
            chevron
            onPress={() => {
              updateSettings({ onboarded: false });
              router.replace('/onboarding');
            }}
          />
          <ListRow
            title="Sources et attributions"
            chevron
            onPress={() => router.push('/attributions')}
          />
        </ListSection>

        {__DEV__ ? (
          <ListSection
            title="Développement"
            footer="Compte les touchers au-dessus de 100 ms et les blocages du fil JavaScript au-dessus de 150 ms."
            style={{ marginTop: theme.space.xl }}
          >
            <ListSwitch
              first
              title="Sonde de fluidité"
              value={settings.probe}
              onChange={(value) => updateSettings({ probe: value })}
            />
          </ListSection>
        ) : null}

        <ListSection style={{ marginTop: theme.space.xxl }}>
          <ListRow
            first
            title="Effacer la progression"
            detail="Cartes, brevets, doublons et séries. Définitif."
            tone="danger"
            onPress={() => {
              tap();
              confirmReset();
            }}
          />
        </ListSection>
      </ScrollView>
    </View>
  );
}

function formatPlayTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}
