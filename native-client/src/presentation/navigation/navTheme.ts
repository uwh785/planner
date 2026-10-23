import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import type { Theme as DesignTheme } from '../theme';

/**
 * The navigator's own colors (the window behind screens, the default
 * header) from the design tokens, so nothing flashes white in dark mode.
 */
export function navigationTheme(design: DesignTheme, dark: boolean): Theme {
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: design.colors.accentText,
      background: design.colors.background,
      card: design.colors.surface,
      text: design.colors.text,
      border: design.colors.border,
      notification: design.colors.danger,
    },
  };
}
