import { darkTheme, lightTheme } from '@/presentation/theme';
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

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as [string, Theme][])(
  '%s theme meets WCAG AA',
  (_name, { colors, minTouch }) => {
    it.each([
      ['text on background', colors.text, colors.background],
      ['text on surface', colors.text, colors.surface],
      ['muted text on background', colors.textMuted, colors.background],
      ['muted text on surface', colors.textMuted, colors.surface],
      ['error text on background', colors.danger, colors.background],
      ['error text on surface', colors.danger, colors.surface],
      ['button label on primary', colors.onPrimary, colors.primary],
      ['text on notice', colors.text, colors.noticeSurface],
    ])('%s is at least 4.5:1', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it.each([
      ['input border on background', colors.border, colors.background],
      ['input border on surface', colors.border, colors.surface],
      ['notice bar on notice', colors.noticeBar, colors.noticeSurface],
    ])('%s is at least 3:1', (_label, fg, bg) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3);
    });

    it('keeps touch targets at 48dp or more', () => {
      expect(minTouch).toBeGreaterThanOrEqual(48);
    });
  },
);
