import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Priority } from '@/domain';
import { Button } from '../atoms/Button';
import { CompleteToggle } from '../atoms/CompleteToggle';
import { GroupedRow, type GroupPosition } from '../atoms/GroupedRow';
import { PriorityIndicator, priorityWord } from '../atoms/PriorityIndicator';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

/** What a row needs to know about a task; no repository types leak in. */
export interface TaskRowModel {
  id: string;
  title: string;
  completed: boolean;
  due: { text: string; overdue: boolean } | null;
  priority: Priority;
}

interface TaskRowProps {
  task: TaskRowModel;
  /** In the undo window: shown as done, with an Undo action. */
  completing: boolean;
  position: GroupPosition;
  onToggle: () => void;
  onUndo: () => void;
  onOpen: () => void;
}

const makeStyles = (t: Theme) => ({
  row: { flexDirection: 'row' as const, alignItems: 'flex-start' as const },
  body: { flex: 1, paddingRight: t.spacing.md },
  open: {
    minHeight: t.minTouch,
    justifyContent: 'center' as const,
    paddingVertical: t.spacing.xs,
  },
  pressed: { opacity: 0.8 },
  title: { ...t.typography.body, color: t.colors.text },
  done: {
    color: t.colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  meta: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    columnGap: t.spacing.sm,
  },
  due: { ...t.typography.callout, color: t.colors.textMuted },
  overdue: { color: t.colors.danger },
  undo: { alignSelf: 'flex-start' as const, marginLeft: -t.spacing.md },
});

/**
 * A task in a group: the complete control, then the title with its due text
 * and priority. Overdue and priority always carry a word; a completed title
 * is struck through. Tapping the body opens the task.
 */
export function TaskRow({
  task,
  completing,
  position,
  onToggle,
  onUndo,
  onOpen,
}: TaskRowProps) {
  const styles = useStyles(makeStyles);
  const done = task.completed || completing;
  const spoken = [
    task.title,
    task.due?.text,
    task.priority > 0 ? `${priorityWord(task.priority)} priority` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const toggleLabel = task.completed
    ? `${task.title}, completed`
    : `Mark ${task.title} as done`;
  return (
    <GroupedRow position={position} testID={`task-row-${task.id}`}>
      <View style={styles.row}>
        <CompleteToggle
          checked={done}
          disabled={task.completed}
          label={toggleLabel}
          onPress={onToggle}
        />
        <View style={styles.body}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={spoken}
            accessibilityHint="Opens the task"
            onPress={onOpen}
            style={({ pressed }) => [styles.open, pressed && styles.pressed]}
          >
            <Text style={[styles.title, done ? styles.done : null]}>
              {task.title}
            </Text>
            {task.due || task.priority > 0 ? (
              <View style={styles.meta}>
                {task.due ? (
                  <Text
                    style={[
                      styles.due,
                      task.due.overdue ? styles.overdue : null,
                    ]}
                  >
                    {task.due.text}
                  </Text>
                ) : null}
                <PriorityIndicator priority={task.priority} />
              </View>
            ) : null}
          </Pressable>
          {completing ? (
            <View style={styles.undo}>
              <Button variant="link" label="Undo" onPress={onUndo} />
            </View>
          ) : null}
        </View>
      </View>
    </GroupedRow>
  );
}
