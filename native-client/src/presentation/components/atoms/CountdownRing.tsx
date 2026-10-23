import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { TaskStatus } from '@/domain';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import { Check } from './icons';

const BASE_SIZE = 40;
const STROKE = 3;

interface CountdownRingProps {
  /** 0 to 1, how much of the time is used. */
  progress: number;
  status: TaskStatus;
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
});

/**
 * The web's CountdownRing: a track, an arc for the time used, the percent
 * in the middle (a check once done). Drawn once per render, no animation;
 * the time left is always written beside it, so the ring is decorative and
 * hidden from screen readers. It grows with the system font so the percent
 * never spills out.
 */
export function CountdownRing({ progress, status }: CountdownRingProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const size = Math.round(BASE_SIZE * Math.min(Math.max(fontScale, 1), 1.6));
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
          <Text style={styles.percent}>{`${Math.round(progress * 100)}%`}</Text>
        )}
      </View>
    </View>
  );
}
