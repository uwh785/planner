import React from 'react';
import { Pressable, Text } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

type Variant = 'primary' | 'secondary' | 'destructive' | 'link';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Shows the busy label and ignores presses (no double submit). */
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  /** Spoken name when it must say more than the label (it still starts with it). */
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
  primary: { backgroundColor: t.colors.primary },
  secondary: {
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
  },
  destructive: {
    borderWidth: 1,
    borderColor: t.colors.danger,
    backgroundColor: t.colors.surface,
  },
  link: {},
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.6 },
  label: { ...t.typography.body, fontWeight: '600' as const },
  labelPrimary: { color: t.colors.onPrimary },
  labelPlain: { color: t.colors.text },
  labelDanger: { color: t.colors.danger },
  labelLink: {
    color: t.colors.accentText,
    textDecorationLine: 'underline' as const,
  },
});

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  busyLabel,
  disabled = false,
  accessibilityLabel,
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
      : variant === 'destructive'
      ? styles.labelDanger
      : styles.labelPlain;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? shown}
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
