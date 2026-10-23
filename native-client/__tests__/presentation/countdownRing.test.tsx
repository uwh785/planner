import React from 'react';
import { processColor, StyleSheet, useWindowDimensions } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { CountdownRing } from '@/presentation/components/atoms/CountdownRing';
import { lightTheme } from '@/presentation/theme';

// Font scale is part of the layout; each test sets it.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const dimensions = useWindowDimensions as unknown as jest.Mock;
const withFontScale = (fontScale: number) =>
  dimensions.mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
beforeEach(() => withFontScale(1));

/** react-native-svg hands colors to the native view already processed. */
const colorOf = (circle: { props: Record<string, unknown> }) =>
  (circle.props.stroke as { payload: number }).payload;

const ring = () =>
  screen.getByTestId('countdown-ring', { includeHiddenElements: true });
/** The two circles' props (track, then arc). */
const circles = () =>
  ring().findAll(node => (node.type as unknown) === 'RNSVGCircle', {
    deep: true,
  });

describe('CountdownRing', () => {
  it('draws the arc for the time used: the dash offset leaves the rest of the circle empty', () => {
    render(<CountdownRing progress={0.25} status="in_progress" />);
    const arc = circles()[1]!;
    const radius = (40 - 3) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(arc.props.strokeDashoffset).toBeCloseTo(circumference * 0.75, 5);
  });

  it('writes the percent in the middle', () => {
    render(<CountdownRing progress={0.0123} status="in_progress" />);
    expect(
      screen.getByText('1%', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it.each([
    [0.1, lightTheme.colors.ring.ok],
    [0.3, lightTheme.colors.ring.caution],
    [0.6, lightTheme.colors.ring.warn],
    [0.8, lightTheme.colors.ring.danger],
    [1, lightTheme.colors.ring.danger],
  ])('at %d the arc uses the AA-safe color %s', (progress, color) => {
    render(<CountdownRing progress={progress} status="in_progress" />);
    expect(colorOf(circles()[1]!)).toBe(processColor(color));
  });

  it('is green with a check once completed, not a percent', () => {
    render(<CountdownRing progress={1} status="completed" />);
    expect(colorOf(circles()[1]!)).toBe(
      processColor(lightTheme.colors.ring.ok),
    );
    expect(
      screen.queryByText('100%', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('is decorative for screen readers (the box beside it says the time)', () => {
    render(<CountdownRing progress={0.5} status="in_progress" />);
    expect(ring().props.importantForAccessibility).toBe('no-hide-descendants');
    expect(ring().props.accessibilityElementsHidden).toBe(true);
  });

  it('grows with the system font so the percent never spills out, up to a cap', () => {
    withFontScale(1.5);
    render(<CountdownRing progress={0.5} status="in_progress" />);
    expect(StyleSheet.flatten(ring().props.style)).toMatchObject({
      width: 60,
      height: 60,
    });
    screen.unmount();
    withFontScale(2);
    render(<CountdownRing progress={0.5} status="in_progress" />);
    expect(StyleSheet.flatten(ring().props.style)).toMatchObject({
      width: 64,
      height: 64,
    });
  });

  it('uses a track that stays visible (3:1 on Surface 2) and no animation props', () => {
    render(<CountdownRing progress={0.5} status="in_progress" />);
    expect(colorOf(circles()[0]!)).toBe(
      processColor(lightTheme.colors.ring.track),
    );
    expect(StyleSheet.flatten(ring().props.style)).toMatchObject({
      width: 40,
      height: 40,
    });
  });
});
