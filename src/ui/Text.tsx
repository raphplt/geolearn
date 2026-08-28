import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type Colors, type TextRole } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TextRole;
  color?: keyof Colors | (string & {});
  align?: 'left' | 'center' | 'right';
  tabular?: boolean;
};

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
