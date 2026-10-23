import React from 'react';
import { Pressable, Text } from 'react-native';
import { ColorDot } from '../atoms/ColorDot';
import { GroupedRow, type GroupPosition } from '../atoms/GroupedRow';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface ListRowProps {
  name: string;
  openCount: number;
  /** The list's color; null for the "All tasks" row. */
  color: string | null;
  position: GroupPosition;
  onPress: () => void;
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
  name: { ...t.typography.body, color: t.colors.text, flex: 1 },
  count: { ...t.typography.callout, color: t.colors.textMuted },
});

export const openTasksText = (n: number): string =>
  n === 0 ? 'no open tasks' : n === 1 ? '1 open task' : `${n} open tasks`;

/** A list in the lists group: color marker, name, and how many are open. */
export function ListRow({
  name,
  openCount,
  color,
  position,
  onPress,
}: ListRowProps) {
  const styles = useStyles(makeStyles);
  return (
    <GroupedRow position={position}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${openTasksText(openCount)}`}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <ColorDot color={color} />
        <Text style={styles.name}>{name}</Text>
        {openCount > 0 ? (
          <Text style={styles.count}>{`${openCount} open`}</Text>
        ) : null}
      </Pressable>
    </GroupedRow>
  );
}
