import React from 'react';
import { Pressable, Text } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

type Variant = 'primary' | 'secondary' | 'link';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Shows the busy label and ignores presses (no double submit). */
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  testID?: string;
}

const makeStyles = (t: Theme) => ({
  base: {
    minHeight: t.minTouch,
    minWidth: t.minTouch,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radius,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primary: { backgroundColor: t.colors.primary },
  secondary: {
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  link: {},
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.6 },
  label: { fontSize: t.type.body, fontWeight: '600' as const },
  labelPrimary: { color: t.colors.onPrimary },
  labelPlain: { color: t.colors.text },
  labelLink: { color: t.colors.text, textDecorationLine: 'underline' as const },
});

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  busyLabel,
  disabled = false,
  testID,
}: ButtonProps) {
  const styles = useStyles(makeStyles);
  const inactive = disabled || busy;
  const shown = busy && busyLabel ? busyLabel : label;
  const labelStyle =
    variant === 'primary'
      ? styles.labelPrimary
      : variant === 'link'
      ? styles.labelLink
      : styles.labelPlain;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      <Text style={[styles.label, labelStyle]}>{shown}</Text>
    </Pressable>
  );
}
