import React from 'react';
import { Text, View } from 'react-native';
import type { Priority } from '@/domain';
import type { MessageKey } from '@/application/i18n';
import { Flag } from '../atoms/icons';
import { useT } from '../../i18n/I18nProvider';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

const WORD: Record<Priority, MessageKey | null> = {
  0: null,
  1: 'taskPriorityLow',
  2: 'taskPriorityMedium',
  3: 'taskPriorityHigh',
};

const makeStyles = (t: Theme) => ({
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xxs,
    paddingVertical: 2,
    paddingHorizontal: t.spacing.xs,
    borderRadius: 6,
    backgroundColor: t.colors.surface2,
  },
  // The web paints this word in the priority color (red on dark fails AA);
  // the word keeps the text color and the flag carries the color.
  word: {
    ...t.typography.caption,
    color: t.colors.text,
    fontWeight: '600' as const,
  },
});

/** The translated priority word. None has no word. */
export function usePriorityWord(priority: Priority): string | null {
  const t = useT();
  const key = WORD[priority];
  return key === null ? null : t(key);
}

/** A flag icon and the priority word on Surface 2. None shows nothing. */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const word = usePriorityWord(priority);
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
    <View style={styles.pill}>
      <Flag size={12} color={color} strokeWidth={2.5} />
      <Text style={styles.word}>{word}</Text>
    </View>
  );
}
