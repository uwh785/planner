import React from 'react';
import { View } from 'react-native';
import type { TaskStatus } from '@/domain';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

const SIZE = 10;

const makeStyles = (t: Theme) => ({
  base: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  // Shape differs, not only color: hollow, filled, filled and muted.
  pending: { borderWidth: 2, borderColor: t.colors.borderStrong },
  in_progress: { backgroundColor: t.colors.accent },
  completed: { backgroundColor: t.colors.textMuted },
});

/**
 * The card's status marker (the web's dot). Decorative: the status is also
 * said in the card's spoken label, and an in-progress card has an accent edge.
 */
export function StatusDot({ status }: { status: TaskStatus }) {
  const styles = useStyles(makeStyles);
  return (
    <View
      testID={`status-dot-${status}`}
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, styles[status]]}
    />
  );
}
