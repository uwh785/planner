import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** A decorative marker before the label (a list's color). */
  leading?: React.ReactNode;
}

interface FilterChipsProps<T extends string> {
  /** Spoken name of the whole group, e.g. "Filter by status". */
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

const makeStyles = (t: Theme) => ({
  row: {
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.xxs,
  },
  chip: {
    minHeight: t.minTouch,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.control,
    borderWidth: 1,
    borderColor: t.colors.borderStrong,
  },
  // Selected is not color alone: a thicker accent edge, a surface fill and a
  // heavier label.
  chipOn: {
    borderWidth: 2,
    borderColor: t.colors.accent,
    backgroundColor: t.colors.surface,
  },
  pressed: { opacity: 0.8 },
  label: { ...t.typography.callout, color: t.colors.textMuted },
  labelOn: { color: t.colors.accentText, fontWeight: '700' as const },
});

/**
 * The web's filter buttons as a horizontally scrolling row of chips (one
 * choice at a time). The chip's label is its name; the selected one is
 * announced as selected.
 */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterChipsProps<T>) {
  const styles = useStyles(makeStyles);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipOn : null,
                pressed && styles.pressed,
              ]}
            >
              {option.leading}
              <Text style={[styles.label, selected ? styles.labelOn : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
