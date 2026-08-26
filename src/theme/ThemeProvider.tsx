import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  borderWidth,
  colorSchemes,
  elevation,
  hitTarget,
  motion,
  opacity,
  radius,
  space,
  type ColorScheme,
  type Colors,
} from './tokens';
import { fontFamily, textRoles } from './typography';

export type SchemePreference = ColorScheme | 'system';

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  elevation: typeof elevation;
  motion: typeof motion;
  hitTarget: typeof hitTarget;
  opacity: typeof opacity;
  text: typeof textRoles;
  fontFamily: typeof fontFamily;
};

function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: colorSchemes[scheme],
    space,
    radius,
    borderWidth,
    elevation,
    motion,
    hitTarget,
    opacity,
    text: textRoles,
    fontFamily,
  };
}

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({
  preference = 'system',
  children,
}: {
  preference?: SchemePreference;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Crée des styles dépendants du thème sans recalcul à chaque rendu.
 *
 *   const useStyles = makeStyles((t) => ({ card: { padding: t.space.lg } }));
 *   const styles = useStyles();
 */
export function makeStyles<T extends Record<string, unknown>>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => factory(theme), [theme]);
  };
}
