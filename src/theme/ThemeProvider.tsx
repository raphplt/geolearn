import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { InkId } from '@/game/economy';
import { withInk } from './inks';
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
  ink: InkId;
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

function buildTheme(scheme: ColorScheme, ink: InkId): Theme {
  return {
    scheme,
    ink,
    colors: withInk(colorSchemes[scheme], scheme, ink),
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

const ThemeContext = createContext<Theme>(buildTheme('light', 'sepia'));

export function ThemeProvider({
  preference = 'system',
  ink = 'sepia',
  children,
}: {
  preference?: SchemePreference;
  ink?: InkId;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const theme = useMemo(() => buildTheme(scheme, ink), [scheme, ink]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function makeStyles<T extends Record<string, unknown>>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => factory(theme), [theme]);
  };
}
