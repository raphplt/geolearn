import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type Colors, type TextRole } from '@/theme';

export type TextProps = RNTextProps & {
  /**
   * Rôle typographique. On style par rôle, jamais par taille brute.
   *
   * Nommé `variant` et non `role` : React Native réserve déjà `role` à
   * l'attribut ARIA, dont le type contient la valeur `'note'`. Intersecter les
   * deux ne laissait passer que cette unique valeur commune — et l'erreur, qui
   * se manifestait loin d'ici sur chaque appel, était indéchiffrable.
   */
  variant?: TextRole;
  /** Rôle de couleur du thème, ou couleur littérale pour les cas ponctuels. */
  color?: keyof Colors | (string & {});
  align?: 'left' | 'center' | 'right';
  /** Chiffres à chasse fixe : indispensable dès qu'une valeur change en place. */
  tabular?: boolean;
};

/**
 * Texte de l'application.
 *
 * Le garde-fou utile ici est `tabular`. Un score ou un compte à rebours dont
 * les chiffres n'ont pas la même largeur fait sautiller la mise en page à
 * chaque incrément — un défaut discret mais qui donne à l'ensemble un aspect
 * bâclé, précisément là où le joueur regarde le plus.
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  tabular,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const resolved = (theme.colors as Record<string, string>)[color as string] ?? color;

  return (
    <RNText
      {...rest}
      style={[
        theme.text[variant],
        { color: resolved },
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
