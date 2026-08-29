export const UN_MEMBERSHIP_OVERRIDES: Record<string, boolean> = { VAT: false };

export const POPULATION_EXEMPT = new Set(['VAT']);

export const REGION_FR: Record<string, string> = {
  Africa: 'Afrique',
  Americas: 'Amériques',
  Antarctic: 'Antarctique',
  Asia: 'Asie',
  Europe: 'Europe',
  Oceania: 'Océanie',
};

export const SUBREGION_FR: Record<string, string> = {
  'Australia and New Zealand': 'Australie et Nouvelle-Zélande',
  Caribbean: 'Caraïbes',
  'Central America': 'Amérique centrale',
  'Central Asia': 'Asie centrale',
  'Central Europe': 'Europe centrale',
  'Eastern Africa': 'Afrique de l’Est',
  'Eastern Asia': 'Asie de l’Est',
  'Eastern Europe': 'Europe de l’Est',
  Melanesia: 'Mélanésie',
  Micronesia: 'Micronésie',
  'Middle Africa': 'Afrique centrale',
  'North America': 'Amérique du Nord',
  'Northern Africa': 'Afrique du Nord',
  'Northern Europe': 'Europe du Nord',
  Polynesia: 'Polynésie',
  'South America': 'Amérique du Sud',
  'South-Eastern Asia': 'Asie du Sud-Est',
  'Southeast Europe': 'Europe du Sud-Est',
  'Southern Africa': 'Afrique australe',
  'Southern Asia': 'Asie du Sud',
  'Southern Europe': 'Europe du Sud',
  'Western Africa': 'Afrique de l’Ouest',
  'Western Asia': 'Asie de l’Ouest',
  'Western Europe': 'Europe de l’Ouest',
};

export function translateRegion(table: Record<string, string>, value: string): string {
  if (!value) return '';
  const hit = table[value];
  if (hit) return hit;
  console.warn(`  ! libellé de région non traduit : « ${value} »`);
  return value;
}
