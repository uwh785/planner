import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Clock } from '../atoms/icons';
import type { ComponentType } from 'react';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

interface TimeFieldProps {
  label: string;
  /** "08:00". */
  time: string;
  error?: string | null;
  /** The leading icon; a clock unless the field holds a date. */
  icon?: ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
}

const makeStyles = (t: Theme) => ({
  wrap: { flex: 1 },
  label: {
    ...t.typography.callout,
    color: t.colors.textMuted,
    marginBottom: t.spacing.xxs,
  },
  field: {
    minHeight: t.minTouch,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
    borderRadius: t.radii.control,
    backgroundColor: t.colors.surface,
  },
  fieldError: { borderColor: t.colors.danger, borderWidth: 2 },
  pressed: { opacity: 0.8 },
  time: { ...t.typography.body, color: t.colors.text },
  error: {
    ...t.typography.caption,
    color: t.colors.danger,
    marginTop: t.spacing.xxs,
  },
});

/**
 * A time of day (or a date, with another icon) that opens the system dialog;
 * the value is the button.
 */
export function TimeField({
  label,
  time,
  error,
  icon: Icon = Clock,
  onPress,
}: TimeFieldProps) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text importantForAccessibility="no" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${time}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          error ? styles.fieldError : null,
          pressed && styles.pressed,
        ]}
      >
        <Icon size={18} color={colors.textMuted} />
        <Text style={styles.time}>{time}</Text>
      </Pressable>
      <View accessibilityLiveRegion="polite">
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}
