import {
  brand,
  darkTheme,
  lightTheme,
  radii,
  spacing,
  typography,
  minTouch,
} from '@/presentation/theme';
import type { Theme } from '@/presentation/theme';

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** The web app's values (web/src/app.css), the canonical brand. */
const WEB = {
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

describe('brand palette', () => {
  it.each(['dark', 'light'] as const)(
    'keeps the web %s values as the canonical brand',
    scheme => {
      expect(brand[scheme]).toEqual(WEB[scheme]);
    },
  );

  it.each([
    ['dark', darkTheme],
    ['light', lightTheme],
  ] as const)(
    '%s theme surfaces and text keep the web identity',
    (scheme, theme) => {
      const web = WEB[scheme];
      expect(theme.colors.background).toBe(web.bg);
      expect(theme.colors.surface).toBe(web.surface);
      expect(theme.colors.surface2).toBe(web.surface2);
      expect(theme.colors.border).toBe(web.border);
      expect(theme.colors.text).toBe(web.text);
      expect(theme.colors.accent).toBe(web.accent);
    },
  );

  it('only adjusts the web values that fail WCAG AA', () => {
    // Every adjusted token, with the web value it replaces and why.
    const adjusted: [string, string, string][] = [
      ['light textMuted', WEB.light.text2, lightTheme.colors.textMuted],
      ['light accentText', WEB.light.accent, lightTheme.colors.accentText],
      ['light primary', WEB.light.accent, lightTheme.colors.primary],
      ['light danger', WEB.light.red, lightTheme.colors.danger],
    ];
    for (const [, web, ours] of adjusted) {
      expect(web).not.toBe(ours);
    }
    // The web values being replaced really do fail on the surfaces we use.
    expect(contrast(WEB.light.text2, WEB.light.bg)).toBeLessThan(4.5);
    expect(contrast(WEB.light.accent, WEB.light.bg)).toBeLessThan(4.5);
    expect(contrast('#ffffff', WEB.light.accent)).toBeLessThan(4.5);
    expect(contrast(WEB.light.red, WEB.light.bg)).toBeLessThan(4.5);
    // Dark keeps the web values for text, link and error colors.
    expect(darkTheme.colors.textMuted).toBe(WEB.dark.text2);
    expect(darkTheme.colors.accentText).toBe(WEB.dark.accent);
    expect(darkTheme.colors.danger).toBe(WEB.dark.red);
  });
});

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as [string, Theme][])('%s theme meets WCAG AA', (_name, { colors }) => {
  it.each([
    ['text on background', colors.text, colors.background],
    ['text on surface', colors.text, colors.surface],
    ['text on surface2 (notice, chip)', colors.text, colors.surface2],
    ['muted text on background', colors.textMuted, colors.background],
    ['muted text on surface', colors.textMuted, colors.surface],
    ['link text on background', colors.accentText, colors.background],
    ['link text on surface', colors.accentText, colors.surface],
    ['error text on background', colors.danger, colors.background],
    ['error text on surface', colors.danger, colors.surface],
    ['button label on primary', colors.onPrimary, colors.primary],
    ['success text on background', colors.success, colors.background],
    ['success text on surface', colors.success, colors.surface],
  ])('%s is at least 4.5:1', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['input border on background', colors.borderStrong, colors.background],
    ['input border on surface', colors.borderStrong, colors.surface],
    ['focus ring on background', colors.accent, colors.background],
    ['focus ring on surface', colors.accent, colors.surface],
    ['error outline on surface', colors.danger, colors.surface],
    ['priority none on surface', colors.priority.none, colors.surface],
    ['priority low on surface', colors.priority.low, colors.surface],
    ['priority medium on surface', colors.priority.medium, colors.surface],
    ['priority high on surface', colors.priority.high, colors.surface],
    ['priority none on background', colors.priority.none, colors.background],
    ['priority low on background', colors.priority.low, colors.background],
    [
      'priority medium on background',
      colors.priority.medium,
      colors.background,
    ],
    ['priority high on background', colors.priority.high, colors.background],
    // The priority badge sits on Surface 2 (the card's remaining-time box too).
    ['priority none on surface2', colors.priority.none, colors.surface2],
    ['priority low on surface2', colors.priority.low, colors.surface2],
    ['priority medium on surface2', colors.priority.medium, colors.surface2],
    ['priority high on surface2', colors.priority.high, colors.surface2],
    ['ring track on surface2', colors.ring.track, colors.surface2],
    ['ring ok on surface2', colors.ring.ok, colors.surface2],
    ['ring caution on surface2', colors.ring.caution, colors.surface2],
    ['ring warn on surface2', colors.ring.warn, colors.surface2],
    ['ring danger on surface2', colors.ring.danger, colors.surface2],
    ['active chip border on background', colors.accent, colors.background],
  ])('%s is at least 3:1', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('web values replaced for the Panel and task card', () => {
  it('the web light green and the web light ring colors fail where the app uses them', () => {
    expect(contrast(WEB.light.green, WEB.light.surface)).toBeLessThan(4.5);
    expect(contrast(WEB.light.green, WEB.light.surface2)).toBeLessThan(3);
    expect(contrast(WEB.light.yellow, WEB.light.surface2)).toBeLessThan(3);
    expect(contrast(WEB.light.orange, WEB.light.surface2)).toBeLessThan(3);
    expect(lightTheme.colors.success).not.toBe(WEB.light.green);
    expect(lightTheme.colors.ring.ok).not.toBe(WEB.light.green);
  });

  it('dark keeps the web green, yellow and orange for the ring', () => {
    expect(darkTheme.colors.success).toBe(WEB.dark.green);
    expect(darkTheme.colors.ring.ok).toBe(WEB.dark.green);
    expect(darkTheme.colors.ring.caution).toBe(WEB.dark.yellow);
    expect(darkTheme.colors.ring.warn).toBe(WEB.dark.orange);
    expect(darkTheme.colors.ring.danger).toBe(WEB.dark.red);
  });

  it('the web priority label (red on Surface 2) fails in dark, which is why the word uses the text color', () => {
    expect(contrast(WEB.dark.red, WEB.dark.surface2)).toBeLessThan(4.5);
    expect(
      contrast(darkTheme.colors.text, darkTheme.colors.surface2),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('layout and type tokens', () => {
  it('keeps touch targets at 48dp or more', () => {
    expect(minTouch).toBeGreaterThanOrEqual(48);
    expect(lightTheme.minTouch).toBe(minTouch);
  });

  it('uses the 4/8/12/16/24/32/48 spacing scale', () => {
    expect(Object.values(spacing)).toEqual([4, 8, 12, 16, 24, 32, 48]);
  });

  it('uses 10 for controls, as on the web, and larger radii for sheets', () => {
    expect(radii.control).toBe(10);
    expect(radii.sheet).toBeGreaterThan(radii.card);
    expect(radii.card).toBeGreaterThan(radii.control);
  });

  it('separates the main roles by at least a 1.25 size ratio', () => {
    const size = (role: keyof typeof typography) => typography[role].fontSize;
    expect(size('title') / size('headline')).toBeGreaterThanOrEqual(1.25);
    expect(size('headline') / size('body')).toBeGreaterThanOrEqual(1.25);
    expect(size('body') / size('caption')).toBeGreaterThanOrEqual(1.25);
  });

  it('gives every role a line height of at least 1.15 times its size', () => {
    for (const role of Object.values(typography)) {
      expect(role.lineHeight / role.fontSize).toBeGreaterThanOrEqual(1.15);
    }
  });

  it('uses the platform font only', () => {
    for (const role of Object.values(typography)) {
      expect(role).not.toHaveProperty('fontFamily');
    }
  });
});
