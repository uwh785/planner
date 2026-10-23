import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { TaskStatus } from '@/domain';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import { Check } from './icons';

/**
 * `compact` is the task card's ring (40dp, 3dp stroke); `large` is the detail
 * screen's (80dp, 6dp stroke), both as on the web. Each grows with the system
 * font, up to the cap, so the percent never spills out.
 */
const SIZES = {
  compact: { base: 40, stroke: 3, maxScale: 1.6 },
  large: { base: 80, stroke: 6, maxScale: 1.5 },
} as const;

interface CountdownRingProps {
  /** 0 to 1, how much of the time is used. */
  progress: number;
  status: TaskStatus;
  size?: keyof typeof SIZES;
}

const makeStyles = (t: Theme) => ({
  center: {
    position: 'absolute' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  percent: {
    ...t.typography.caption,
    color: t.colors.text,
    fontWeight: '600' as const,
  },
  percentLarge: { ...t.typography.callout, fontWeight: '600' as const },
});

/**
 * The web's CountdownRing: a track, an arc for the time used, the percent
 * in the middle (a check once done). Drawn once per render, no animation;
 * the time left is always written beside it, so the ring is decorative and
 * hidden from screen readers. It grows with the system font so the percent
 * never spills out.
 */
export function CountdownRing({
  progress,
  status,
  size: variant = 'compact',
}: CountdownRingProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const { base, stroke: STROKE, maxScale } = SIZES[variant];
  const size = Math.round(base * Math.min(Math.max(fontScale, 1), maxScale));
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const done = status === 'completed';
  const color = done
    ? colors.ring.ok
    : progress > 0.75
    ? colors.ring.danger
    : progress > 0.5
    ? colors.ring.warn
    : progress > 0.25
    ? colors.ring.caution
    : colors.ring.ok;
  return (
    <View
      testID="countdown-ring"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.ring.track}
          strokeWidth={STROKE}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>
        {done ? (
          <Check size={size * 0.4} strokeWidth={3} color={colors.ring.ok} />
        ) : (
          <Text
            style={[styles.percent, variant === 'large' && styles.percentLarge]}
          >{`${Math.round(progress * 100)}%`}</Text>
        )}
      </View>
    </View>
  );
}
