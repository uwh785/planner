import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ColorDot } from '../atoms/ColorDot';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import type { ReminderModel } from '../../format/remindersModel';

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
  words: { flex: 1 },
  title: { ...t.typography.body, color: t.colors.text },
  date: {
    ...t.typography.callout,
    fontWeight: '400' as const,
    color: t.colors.textMuted,
  },
  countdown: {
    ...t.typography.callout,
    fontWeight: '700' as const,
    color: t.colors.text,
    flexShrink: 0,
  },
});

/**
 * One reminder: the event's color dot, its title over its date, and the days
 * left at the end. The countdown is words, never color alone; the row reads
 * as one sentence and opens the event.
 */
export function ReminderRow({
  model,
  onPress,
}: {
  model: ReminderModel;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={model.spoken}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ColorDot color={model.color || colors.accent} />
      <View style={styles.words}>
        <Text style={styles.title} numberOfLines={2}>
          {model.title}
        </Text>
        <Text style={styles.date}>{model.date}</Text>
      </View>
      <Text style={styles.countdown}>{model.countdown}</Text>
    </Pressable>
  );
}
