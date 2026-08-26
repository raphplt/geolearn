/**
 * Point d'accès unique aux atlas embarqués.
 *
 * Les JSON sont importés statiquement : Metro les inclut au paquet, ce qui rend
 * l'application entièrement jouable hors ligne et supprime tout état de
 * chargement au démarrage — la carte est peinte au premier rendu.
 */
import franceDepartments from './france-departments.json';
import worldCountries from './world-countries.json';
import type { FranceAtlas, WorldAtlas } from './types';

export const FRANCE: FranceAtlas = franceDepartments as unknown as FranceAtlas;
export const WORLD: WorldAtlas = worldCountries as unknown as WorldAtlas;

export const ATLASES = {
  'france-departments': FRANCE,
  'world-countries': WORLD,
} as const;

export type AtlasId = keyof typeof ATLASES;

export const ATLAS_IDS = Object.keys(ATLASES) as AtlasId[];

export * from './types';
