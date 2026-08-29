import { View } from 'react-native';

import { ATLASES, type AtlasId } from '@/data';
import { plans, type Plan, type PlanId } from '@/game/plan';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { ListRow } from '@/ui/List';
import { Segmented } from '@/ui/Segmented';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const ATLAS_LABEL: Record<AtlasId, string> = {
  'france-departments': 'France',
  'world-countries': 'Monde',
};

const ATLAS_OPTIONS = (Object.keys(ATLASES) as AtlasId[]).map((id) => ({
  value: id,
  label: ATLAS_LABEL[id],
}));

/**
 * Choosing what to play is a temporary decision, so it rises from the bottom
 * edge rather than replacing the screen. One line per mode, and the button
 * repeats the choice instead of saying "Commencer".
 */
export function EmbarkSheet({
  visible,
  onClose,
  atlasId,
  atlases,
  onAtlas,
  selected,
  onSelect,
  onLaunch,
  input,
}: {
  visible: boolean;
  onClose: () => void;
  atlasId: AtlasId;
  /** Only what the player is actually learning appears here. */
  atlases: readonly AtlasId[];
  onAtlas: (id: AtlasId) => void;
  selected: PlanId;
  onSelect: (id: PlanId) => void;
  onLaunch: (plan: Plan) => void;
  input: Parameters<typeof plans>[0];
}) {
  const theme = useTheme();

  const options = ATLAS_OPTIONS.filter((o) => atlases.includes(o.value));
  const available = plans(input);
  const current = available.find((p) => p.id === selected) ?? available[2]!;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="Embarquer"
      title={ATLAS_LABEL[atlasId]}
      footer={
        <Button
          label={current.action}
          detail={`${current.title} · ${current.duration}`}
          size="lg"
          tone={
            current.id === 'expedition' ? 'danger' : current.id === 'daily' ? 'reward' : 'success'
          }
          block
          disabled={!current.available}
          onPress={() => onLaunch(current)}
        />
      }
    >
      {options.length > 1 ? (
        <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.md }}>
          <Segmented
            options={options}
            value={atlasId}
            onChange={onAtlas}
            accessibilityLabel="Terrain de jeu"
          />
        </View>
      ) : null}

      <View style={{ paddingTop: theme.space.md }}>
        {available.map((plan, i) => (
          <ListRow
            key={plan.id}
            first={i === 0}
            accessibilityRole="radio"
            title={plan.title}
            detail={plan.detail}
            selected={plan.id === selected}
            disabled={!plan.available}
            onPress={() => onSelect(plan.id)}
            trailing={
              <View style={{ alignItems: 'flex-end' }}>
                {plan.count > 0 ? (
                  <Text variant="numeralSm" color="text" tabular>
                    {plan.count}
                  </Text>
                ) : null}
                <Text variant="caption" color="textTertiary">
                  {plan.duration}
                </Text>
              </View>
            }
          />
        ))}
      </View>
    </Sheet>
  );
}
