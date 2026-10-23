import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface RadioRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** A marker before the label (color dot, flag). Decorative. */
  leading?: React.ReactNode;
}

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: t.minTouch,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    gap: t.spacing.sm,
  },
  pressed: { opacity: 0.8 },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ringOn: { borderColor: t.colors.primary },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.colors.primary,
  },
  label: { ...t.typography.body, color: t.colors.text, flexShrink: 1 },
  labelOn: { fontWeight: '600' as const },
});

/** One choice of a single-choice group: a ring, an optional marker, a word. */
export function RadioRow({ label, selected, onPress, leading }: RadioRowProps) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.ring, selected ? styles.ringOn : null]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
      {leading}
      <Text style={[styles.label, selected ? styles.labelOn : null]}>
        {label}
      </Text>
    </Pressable>
  );
}
