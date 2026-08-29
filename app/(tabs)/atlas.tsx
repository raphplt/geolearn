import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ATLASES, type AtlasId } from '@/data';
import type { Country, Department, Territory } from '@/data/types';
import { cartouchesOf, masteryOf, playableIds } from '@/game/mastery';
import { cardIdFor, SKILLS_BY_ATLAS, type Skill } from '@/game/questions';
import { MASTERED_LEVEL, type Card, type CardId } from '@/game/srs';
import { tap } from '@/fx/haptics';
import { AtlasMap, type TerritoryState } from '@/map/AtlasMap';
import { warmHitIndex } from '@/map/geometry';
import { useProgress } from '@/store/progress';
import { useTheme } from '@/theme';
import { Flag } from '@/ui/Flag';
import { IconChevron, IconSearch } from '@/ui/icons';
import { ListRow, ListSection } from '@/ui/List';
import { usePressResponse } from '@/ui/motion';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useNow } from '@/ui/useNow';

const ATLAS_NAME: Record<AtlasId, string> = {
  'france-departments': 'France',
  'world-countries': 'Monde',
};

const ATLAS_OPTIONS = (Object.keys(ATLASES) as AtlasId[]).map((id) => ({
  value: id,
  label: ATLAS_NAME[id],
}));

const SKILL_LABEL: Record<Skill, string> = {
  locate: 'Situer',
  name: 'Reconnaître',
  prefecture: 'Chef-lieu',
  prefectureToDept: 'Chef-lieu → département',
  code: 'Numéro',
  codeToDept: 'Numéro → département',
  capital: 'Capitale',
  capitalToCountry: 'Capitale → pays',
  flag: 'Drapeau',
};

export default function AtlasScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const cards = useProgress((s) => s.cards);
  const settings = useProgress((s) => s.settings);
  const updateSettings = useProgress((s) => s.updateSettings);
  const atlasId = settings.lastAtlas;
  const atlas = ATLASES[atlasId];

  const [picked, setPicked] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [needle, setNeedle] = useState('');
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    warmHitIndex(atlas);
  }, [atlas]);

  const mastery = useMemo(() => masteryOf(cards, atlasId), [cards, atlasId]);

  const cartouches = useMemo(
    () => cartouchesOf(mastery, atlasId, atlas),
    [mastery, atlasId, atlas],
  );
  const sealed = cartouches.filter((c) => c.sealed);

  const states = useMemo(() => {
    const out: Record<string, TerritoryState> = {};
    for (const [id, level] of mastery.byTerritory) {
      if (level >= MASTERED_LEVEL) out[id] = 'mastered';
      else if (level > 0) out[id] = 'target';
    }
    for (const cartouche of cartouches) {
      if (!cartouche.sealed) continue;
      for (const id of cartouche.territoryIds) out[id] = 'sealed';
    }
    return out;
  }, [mastery.byTerritory, cartouches]);

  const playable = useMemo(() => playableIds(atlasId), [atlasId]);

  const matches = useMemo(() => {
    const query = normalise(needle.trim());
    if (query.length < 2) return [];
    return atlas.territories
      .filter((t) => playable.has(t.id) && normalise(t.name).includes(query))
      .slice(0, 24);
  }, [needle, atlas.territories, playable]);

  const territory = picked ? atlas.territories.find((t) => t.id === picked) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {/* The map is the screen. Everything else floats over it. */}
      <AtlasMap
        atlas={atlas}
        states={states}
        labels="adaptive"
        framed={false}
        onSelect={(id) => {
          if (!playable.has(id)) return;
          tap();
          setPicked(id);
        }}
        style={{ flex: 1 }}
      />

      <View
        style={{
          position: 'absolute',
          top: insets.top + theme.space.sm,
          left: theme.space.lg,
          right: theme.space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
        }}
      >
        <Segmented
          compact
          style={{ flex: 1, ...theme.elevation.lifted }}
          options={ATLAS_OPTIONS}
          value={atlasId}
          onChange={(id) => updateSettings({ lastAtlas: id })}
          accessibilityLabel="Atlas affiché"
        />
        <FloatingButton
          label="Rechercher un territoire"
          onPress={() => {
            setNeedle('');
            setSearching(true);
          }}
        >
          <IconSearch size={20} color={theme.colors.text} />
        </FloatingButton>
      </View>

      <View
        style={{
          position: 'absolute',
          left: theme.space.lg,
          right: theme.space.lg,
          bottom: theme.space.md,
          alignItems: 'flex-start',
          gap: theme.space.sm,
        }}
      >
        {legendOpen ? (
          <View
            style={{
              alignSelf: 'stretch',
              padding: theme.space.md,
              gap: theme.space.sm,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceRaised,
              borderWidth: theme.borderWidth.hair,
              borderColor: theme.colors.border,
              ...theme.elevation.lifted,
            }}
          >
            <Legend swatch={theme.colors.mapLandIdle} label="À découvrir" />
            <Legend swatch={theme.colors.mapTarget} label="En cours" />
            <Legend swatch={theme.colors.mapLand} label="En mémoire longue" />
            {sealed.length > 0 ? (
              <Legend
                swatch={theme.colors.reward}
                label={`${sealed.length} cartouche${sealed.length > 1 ? 's' : ''} scellé${sealed.length > 1 ? 's' : ''}`}
              />
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            tap();
            setLegendOpen((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: legendOpen }}
          accessibilityLabel="Légende de la carte"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            paddingHorizontal: theme.space.md,
            minHeight: 36,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.surfaceRaised,
            borderWidth: theme.borderWidth.hair,
            borderColor: theme.colors.border,
            ...theme.elevation.lifted,
          }}
        >
          <Text variant="labelSm" color="textSecondary" tabular>
            {mastery.mastered} / {mastery.total}
          </Text>
          <View style={{ transform: [{ rotate: legendOpen ? '-90deg' : '90deg' }] }}>
            <IconChevron size={14} color={theme.colors.textTertiary} />
          </View>
        </Pressable>
      </View>

      <Sheet
        visible={searching}
        onClose={() => setSearching(false)}
        eyebrow={ATLAS_NAME[atlasId]}
        title="Rechercher"
      >
        <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.md }}>
          <TextInput
            value={needle}
            onChangeText={setNeedle}
            autoFocus
            placeholder="Nom du territoire"
            placeholderTextColor={theme.colors.textTertiary}
            accessibilityLabel="Nom du territoire"
            style={{
              minHeight: theme.hitTarget.min,
              paddingHorizontal: theme.space.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceSunk,
              borderWidth: theme.borderWidth.hair,
              borderColor: theme.colors.border,
              color: theme.colors.text,
              ...theme.text.body,
            }}
          />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 320, marginTop: theme.space.md }}
        >
          {matches.map((t, i) => (
            <ListRow
              key={t.id}
              first={i === 0}
              title={t.name}
              detail={detailOf(atlasId, t)}
              chevron
              onPress={() => {
                setSearching(false);
                setPicked(t.id);
              }}
            />
          ))}
          {needle.trim().length >= 2 && matches.length === 0 ? (
            <Text
              variant="bodySm"
              color="textTertiary"
              style={{ padding: theme.space.xl }}
              align="center"
            >
              Aucun territoire de cet atlas ne porte ce nom.
            </Text>
          ) : null}
        </ScrollView>
      </Sheet>

      <TerritorySheet
        atlasId={atlasId}
        territory={territory ?? null}
        cards={cards}
        onClose={() => setPicked(null)}
      />
    </View>
  );
}

/** The card of a territory, pulled out of the shape that was touched. */
function TerritorySheet({
  atlasId,
  territory,
  cards,
  onClose,
}: {
  atlasId: AtlasId;
  territory: Territory | null;
  cards: Readonly<Record<CardId, Card>>;
  onClose: () => void;
}) {
  const theme = useTheme();
  const now = useNow();

  const skills = SKILLS_BY_ATLAS[atlasId];
  const country = atlasId === 'world-countries' ? (territory as Country | null) : null;
  const dept = atlasId === 'france-departments' ? (territory as Department | null) : null;

  return (
    <Sheet
      visible={Boolean(territory)}
      onClose={onClose}
      eyebrow={territory ? detailOf(atlasId, territory) : undefined}
      title={territory?.name}
    >
      {territory ? (
        <ScrollView style={{ maxHeight: 420 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              paddingHorizontal: theme.space.xl,
              paddingTop: theme.space.md,
              paddingBottom: theme.space.sm,
            }}
          >
            {country ? <Flag cca2={country.cca2} height={38} /> : null}
            {dept ? (
              <View
                style={{
                  minWidth: 44,
                  paddingHorizontal: theme.space.sm,
                  paddingVertical: theme.space.xs,
                  borderRadius: theme.radius.sm,
                  alignItems: 'center',
                  backgroundColor: theme.colors.surfaceSunk,
                }}
              >
                <Text variant="numeral" tabular>
                  {dept.id}
                </Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text variant="label">{dept?.prefecture ?? country?.capital ?? '—'}</Text>
              <Text variant="caption" color="textTertiary">
                {dept ? 'Chef-lieu' : 'Capitale'}
              </Text>
            </View>
          </View>

          <ListSection title="Ce que vous en savez">
            {skills.map((skill, i) => {
              const card = cards[cardIdFor(atlasId, territory.id, skill)];
              return (
                <ListRow
                  key={skill}
                  first={i === 0}
                  title={SKILL_LABEL[skill]}
                  detail={cardDetail(card, now)}
                  trailing={<Boxes level={card?.level ?? 0} />}
                />
              );
            })}
          </ListSection>
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

function Boxes({ level }: { level: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 14,
            borderRadius: 2,
            backgroundColor:
              i < level
                ? level >= MASTERED_LEVEL
                  ? theme.colors.success
                  : theme.colors.reward
                : theme.colors.surfaceSunk,
          }}
        />
      ))}
    </View>
  );
}

function cardDetail(card: Card | undefined, now: number): string {
  if (!card || card.reviews === 0) return 'Jamais rencontré';
  if (card.due <= now) return 'À revoir maintenant';
  return `À revoir ${relative(card.due - now)}`;
}

function relative(ms: number): string {
  const days = Math.round(ms / (24 * 3_600_000));
  if (days >= 2) return `dans ${days} jours`;
  const hours = Math.round(ms / 3_600_000);
  if (hours >= 2) return `dans ${hours} heures`;
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return `dans ${minutes} min`;
}

function detailOf(atlasId: AtlasId, territory: Territory): string {
  if (atlasId === 'france-departments') {
    const dept = territory as Department;
    return `${dept.id} · ${dept.region}`;
  }
  return (territory as Country).subregion;
}

const normalise = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function FloatingButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const press = usePressResponse(0.06);

  return (
    <Animated.View style={press.style}>
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceRaised,
          borderWidth: theme.borderWidth.hair,
          borderColor: theme.colors.border,
          ...theme.elevation.lifted,
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          backgroundColor: swatch,
          borderWidth: 1,
          borderColor: theme.colors.mapStrokeStrong,
        }}
      />
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}
