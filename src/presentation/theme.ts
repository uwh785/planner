import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

/**
 * The one place for colors, spacing and type. M5 replaces this module with
 * the real design (DESIGN.md); components only read tokens from here.
 *
 * Contrast (WCAG 2.1 AA): `text`, `textMuted`, `danger` and `onPrimary` on
 * their backgrounds are all above 4.5:1; `border` is above 3:1 against the
 * background, as required for input outlines.
 */
export interface Theme {
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    onPrimary: string;
    danger: string;
    noticeSurface: string;
    noticeBar: string;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  type: { title: number; heading: number; body: number; small: number };
  radius: number;
  /** Minimum height of anything tappable (dp). */
  minTouch: number;
}

const shared = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  type: { title: 28, heading: 22, body: 16, small: 14 },
  radius: 8,
  minTouch: 48,
} as const;

export const lightTheme: Theme = {
  ...shared,
  colors: {
    background: '#FAFAF7',
    surface: '#FFFFFF',
    text: '#1F2933',
    textMuted: '#3E4C59',
    border: '#7B8794',
    primary: '#2F5D50',
    onPrimary: '#FFFFFF',
    danger: '#9B1C1C',
    noticeSurface: '#EEF2EF',
    noticeBar: '#2F5D50',
  },
};

export const darkTheme: Theme = {
  ...shared,
  colors: {
    background: '#14181C',
    surface: '#1C2227',
    text: '#F1F3F5',
    textMuted: '#C9D1D9',
    border: '#8B97A3',
    primary: '#8FD0B8',
    onPrimary: '#10231D',
    danger: '#FFB4AB',
    noticeSurface: '#1F2A26',
    noticeBar: '#8FD0B8',
  },
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** Builds a StyleSheet from tokens once per theme. Pass a module-level factory. */
type Style = ViewStyle | TextStyle | ImageStyle;

export function useStyles<T extends Record<string, Style>>(
  factory: (theme: Theme) => T,
): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}
