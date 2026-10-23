import React from 'react';
import { Text, View } from 'react-native';
import type { Priority } from '@/domain';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';
import { FlagIcon } from './Icons';

const WORDS: Record<Priority, string | null> = {
  0: null,
  1: 'Low',
  2: 'Medium',
  3: 'High',
};

const makeStyles = (t: Theme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xxs,
  },
  word: { ...t.typography.callout, color: t.colors.text },
});

/** A flag and a word. None shows nothing; color only reinforces the word. */
export function PriorityIndicator({ priority }: { priority: Priority }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const word = WORDS[priority];
  if (word === null) {
    return null;
  }
  const color = [
    colors.priority.none,
    colors.priority.low,
    colors.priority.medium,
    colors.priority.high,
  ][priority]!;
  return (
    <View style={styles.row}>
      <FlagIcon color={color} />
      <Text style={styles.word}>{word}</Text>
    </View>
  );
}

export const priorityWord = (priority: Priority): string | null =>
  WORDS[priority];
