import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import type { MonthCellModel } from '../../format/monthCellModel';

const makeStyles = (t: Theme) => ({
  cell: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center' as const,
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.xxs,
    gap: t.spacing.xxs,
    borderRadius: t.radii.control,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  // Selected is a thicker accent edge on a surface fill, never color alone.
  selected: {
    borderWidth: 2,
    borderColor: t.colors.accent,
    backgroundColor: t.colors.surface,
  },
  pressed: { opacity: 0.8 },
  number: { ...t.typography.callout, color: t.colors.text },
  // Today is a heavier, accent-colored number.
  numberToday: { color: t.colors.accentText, fontWeight: '700' as const },
  marks: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
  },
  chip: { width: 10, height: 4, borderRadius: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  more: { ...t.typography.caption, color: t.colors.textMuted },
});

/**
 * One day of the month: its number, up to three colored event chips and up
 * to three task dots, each row ending in "+N" when there are more. Today
 * has a bold accent number, the selected day a thick accent edge; every
 * cell is spoken in full ("October 22, 2026, today, 2 events, 1 task").
 */
export function DayCell({
  model,
  onPress,
}: {
  model: MonthCellModel;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={model.spoken}
      accessibilityState={{ selected: model.selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        model.selected ? styles.selected : null,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.number, model.today ? styles.numberToday : null]}>
        {model.day}
      </Text>
      {model.chips.length > 0 ? (
        <View
          style={styles.marks}
          importantForAccessibility="no-hide-descendants"
        >
          {model.chips.map((color, i) => (
            <View
              key={i}
              style={[styles.chip, { backgroundColor: color || colors.accent }]}
            />
          ))}
          {model.moreEvents > 0 ? (
            <Text style={styles.more}>+{model.moreEvents}</Text>
          ) : null}
        </View>
      ) : null}
      {model.dots > 0 ? (
        <View
          style={styles.marks}
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: model.dots }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: colors.accent }]}
            />
          ))}
          {model.moreTasks > 0 ? (
            <Text style={styles.more}>+{model.moreTasks}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
