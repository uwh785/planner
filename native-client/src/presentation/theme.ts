import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

/**
 * The one place for colors, spacing, radii and type. The design is written up
 * in DESIGN.md; components only read tokens from here.
 *
 * The palette is the web app's (web/src/app.css: iOS system colors). A web
 * value is replaced only where it fails WCAG 2.1 AA in the way the app uses
 * it. Measured ratios (contrast on background / surface):
 *   light text2 #8e8e93: 2.92 / 3.26 -> textMuted #636366: 5.37 / 5.99
 *   light accent #007aff as text: 3.60 / 4.02 -> accentText #0062cc: 5.20 / 5.80
 *   white on light accent #007aff: 4.02 -> white on primary #0062cc: 5.80
 *   light red #ff3b30 as text: 3.18 / 3.55 -> danger #c4271c: 5.15 / 5.75
 *   dark: white on accent #0a84ff is 3.65, so the label is black (5.76)
 * Green and yellow stay canonical and are indicators only (never text, never
 * the only signal). `theme.test.ts` asserts every text and UI pairing.
 */
export interface Theme {
  colors: {
    background: string;
    surface: string;
    /** Chips, notices, pressed rows. Text on it must be `text`. */
    surface2: string;
    /** Hairline separator. Decorative only, never the sole edge of a control. */
    border: string;
    /** Edge of an input or secondary button (at least 3:1). */
    borderStrong: string;
    text: string;
    /** Secondary text. Use on background and surface, not on surface2. */
    textMuted: string;
    /** Focus ring and non-text accent (at least 3:1). */
    accent: string;
    /** Links and accent-colored text (at least 4.5:1). */
    accentText: string;
    /** Fill of the primary button. */
    primary: string;
    onPrimary: string;
    /** Error text and error outline. */
    danger: string;
    /** Always paired with an icon and a word, never used alone. */
    priority: { none: string; low: string; medium: string; high: string };
    /** Decorative status dots; never text and never the only signal. */
    indicator: { green: string; yellow: string };
  };
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  /** Minimum height of anything tappable (dp). */
  minTouch: number;
}

/** The web app's canonical values (web/src/app.css), kept for reference. */
export const brand = {
  dark: {
    bg: '#000000',
    surface: '#1c1c1e',
    surface2: '#2c2c2e',
    border: '#38383a',
    text: '#ffffff',
    text2: '#8e8e93',
    accent: '#0a84ff',
    green: '#30d158',
    yellow: '#ffd60a',
    red: '#ff453a',
    orange: '#ff9f0a',
  },
  light: {
    bg: '#f2f2f7',
    surface: '#ffffff',
    surface2: '#e5e5ea',
    border: '#d1d1d6',
    text: '#000000',
    text2: '#8e8e93',
    accent: '#007aff',
    green: '#34c759',
    yellow: '#ffcc00',
    red: '#ff3b30',
    orange: '#ff9500',
  },
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  /** Buttons and inputs (10, as on the web). */
  control: 10,
  /** Grouped lists and cards (12, as on the web task card). */
  card: 12,
  /** Bottom sheets and dialogs. */
  sheet: 20,
  pill: 999,
} as const;

/** Platform system font only. Sizes are dp and scale with the system font. */
export const typography = {
  title: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  headline: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const satisfies Record<string, TextStyle>;

/** Minimum touch target in dp (Material guidance, above WCAG's 24 CSS px). */
export const minTouch = 48;

const shared = { spacing, radii, typography, minTouch };

export const darkTheme: Theme = {
  ...shared,
  colors: {
    background: brand.dark.bg,
    surface: brand.dark.surface,
    surface2: brand.dark.surface2,
    border: brand.dark.border,
    borderStrong: '#6e6e73',
    text: brand.dark.text,
    textMuted: brand.dark.text2,
    accent: brand.dark.accent,
    accentText: brand.dark.accent,
    primary: brand.dark.accent,
    onPrimary: '#000000',
    danger: brand.dark.red,
    priority: {
      none: brand.dark.text2,
      low: brand.dark.accent,
      medium: brand.dark.orange,
      high: brand.dark.red,
    },
    indicator: { green: brand.dark.green, yellow: brand.dark.yellow },
  },
};

export const lightTheme: Theme = {
  ...shared,
  colors: {
    background: brand.light.bg,
    surface: brand.light.surface,
    surface2: brand.light.surface2,
    border: brand.light.border,
    borderStrong: '#85858a',
    text: brand.light.text,
    textMuted: '#636366',
    accent: brand.light.accent,
    accentText: '#0062cc',
    primary: '#0062cc',
    onPrimary: '#ffffff',
    danger: '#c4271c',
    priority: {
      none: '#636366',
      low: '#0062cc',
      medium: '#a85400',
      high: '#c4271c',
    },
    indicator: { green: brand.light.green, yellow: brand.light.yellow },
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
