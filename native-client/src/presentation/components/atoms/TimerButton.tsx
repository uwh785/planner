import React from 'react';
import { Pressable, Text } from 'react-native';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

export type TimerTone = 'start' | 'pause' | 'complete';

interface TimerButtonProps {
  tone: TimerTone;
  label: string;
  onPress: () => void;
  /** `filled` on the detail screen; `outlined` on the task cards (the web's). */
  variant?: 'filled' | 'outlined';
  disabled?: boolean;
  /** Spoken name when it must say more than the label (it starts with it). */
  accessibilityLabel?: string;
  testID?: string;
}

const makeStyles = (t: Theme) => ({
  base: {
    minHeight: t.minTouch,
    minWidth: t.minTouch,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    borderRadius: t.radii.control,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  outlined: { borderWidth: 1, backgroundColor: t.colors.surface },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.6 },
  label: { ...t.typography.body, fontWeight: '600' as const },
});

/**
 * One timer action. The three tones are the web's blue Start, orange Pause
 * and green Complete in their AA-safe values (DESIGN.md): a filled button
 * carries a label that meets 4.5:1 on its fill, an outlined one writes the
 * label in the same color on Surface. The word is always there, so color is
 * never the only signal.
 */
export function TimerButton({
  tone,
  label,
  onPress,
  variant = 'filled',
  disabled = false,
  accessibilityLabel,
  testID,
}: TimerButtonProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { fill, onFill, text } = {
    start: {
      fill: colors.primary,
      onFill: colors.onPrimary,
      text: colors.accentText,
    },
    pause: {
      fill: colors.action.pause,
      onFill: colors.action.onPause,
      text: colors.action.pause,
    },
    complete: {
      fill: colors.action.complete,
      onFill: colors.action.onComplete,
      text: colors.action.complete,
    },
  }[tone];
  const outlined = variant === 'outlined';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        outlined ? styles.outlined : null,
        outlined ? { borderColor: text } : { backgroundColor: fill },
        pressed && styles.pressed,
        disabled && styles.inactive,
      ]}
    >
      <Text style={[styles.label, { color: outlined ? text : onFill }]}>
        {label}
      </Text>
    </Pressable>
  );
}
