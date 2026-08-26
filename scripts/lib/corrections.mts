/**
 * Corrections et exceptions appliquées aux sources amont.
 *
 * Isolées ici pour deux raisons : elles doivent être partagées entre le script
 * de construction et celui de vérification, et surtout, chaque écart à une
 * source publique mérite d'être écrit noir sur blanc plutôt que dilué dans le
 * pipeline. Toute entrée de ce fichier est une affirmation factuelle qui engage
 * l'application.
 */

/**
 * mledoze/countries classe le Saint-Siège parmi les membres de l'ONU, ce qui
 * porte son décompte à 194. Le Vatican en est en réalité un *État observateur*,
 * au même titre que la Palestine — que la même source classe, elle,
 * correctement. Sans cette correction, l'application enseignerait un fait faux
 * et proposerait un 194ᵉ membre inexistant.
 */
export const UN_MEMBERSHIP_OVERRIDES: Record<string, boolean> = { VAT: false };

/**
 * Pays pour lesquels la Banque mondiale ne publie légitimement aucune
 * population : on préfère une absence assumée à un chiffre inventé.
 */
export const POPULATION_EXEMPT = new Set(['VAT']);

/**
 * Traduction française des régions et sous-régions.
 *
 * mledoze/countries ne les fournit qu'en anglais. Les laisser telles quelles
 * afficherait « Western Europe » sous « France » dans une application
 * entièrement francophone — et surtout, ces libellés servent de ligne
 * secondaire aux propositions de réponse, là où le joueur lit vite. La table
 * est close : les 6 régions et 24 sous-régions de la nomenclature M49 des
 * Nations unies, telle que la source l'emploie.
 */
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

/** Traduit un libellé, en signalant bruyamment toute valeur non prévue. */
export function translateRegion(table: Record<string, string>, value: string): string {
  if (!value) return '';
  const hit = table[value];
  if (hit) return hit;
  console.warn(`  ! libellé de région non traduit : « ${value} »`);
  return value;
}
