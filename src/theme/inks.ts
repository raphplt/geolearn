import type { Colors, ColorScheme } from './tokens';
import type { InkId } from '@/game/economy';

export type InkKey =
  | 'mapWater'
  | 'mapWaterDeep'
  | 'mapLandIdle'
  | 'mapLand'
  | 'mapStroke'
  | 'mapStrokeStrong'
  | 'mapGraticule'
  | 'mapTarget'
  | 'mapCorrect'
  | 'mapWrong'
  | 'mapLabel'
  | 'mapLabelHalo';

export type InkPalette = Partial<Record<InkKey, string>>;

export const INK_PALETTES: Record<InkId, Record<ColorScheme, InkPalette>> = {
  sepia: { light: {}, dark: {} },

  'nuit-de-chine': {
    light: {
      mapWater: '#8FA8C2',
      mapWaterDeep: '#3E587A',
      mapLandIdle: '#EEEDE8',
      mapLand: '#2F5480',
      mapStroke: '#7E8A9C',
      mapStrokeStrong: '#1B2536',
      mapGraticule: '#6E88A6',
      mapTarget: '#D9AE51',
      mapCorrect: '#2F7F70',
      mapWrong: '#C4614A',
      mapLabel: '#1B2536',
      mapLabelHalo: '#FBFBF9',
    },
    dark: {
      mapWater: '#070C14',
      mapWaterDeep: '#03060A',
      mapLandIdle: '#2F4056',
      mapLand: '#417FC4',
      mapStroke: '#5F7391',
      mapStrokeStrong: '#AEC4DE',
      mapGraticule: '#1B2A3E',
      mapTarget: '#EDC15A',
      mapCorrect: '#4FBBA0',
      mapWrong: '#F0765A',
      mapLabel: '#E7EEF6',
      mapLabelHalo: '#080D14',
    },
  },

  sanguine: {
    light: {
      mapWater: '#CCA876',
      mapWaterDeep: '#8A6031',
      mapLandIdle: '#F5E9DD',
      mapLand: '#A03C22',
      mapStroke: '#A97C5C',
      mapStrokeStrong: '#3A1B10',
      mapGraticule: '#B98F5E',
      mapTarget: '#458B7A',
      mapCorrect: '#2A6E60',
      mapWrong: '#8E2314',
      mapLabel: '#3A1B10',
      mapLabelHalo: '#FFF8F0',
    },
    dark: {
      mapWater: '#140A05',
      mapWaterDeep: '#0A0402',
      mapLandIdle: '#5A3626',
      mapLand: '#C95738',
      mapStroke: '#92624F',
      mapStrokeStrong: '#E4BFA6',
      mapGraticule: '#2C1810',
      mapTarget: '#E8C77A',
      mapCorrect: '#4FBBA0',
      mapWrong: '#E8654A',
      mapLabel: '#F6E5D6',
      mapLabelHalo: '#140A05',
    },
  },
};

export function withInk(colors: Colors, scheme: ColorScheme, ink: InkId): Colors {
  const palette = INK_PALETTES[ink]?.[scheme];
  if (!palette) return colors;
  return { ...colors, ...palette };
}
