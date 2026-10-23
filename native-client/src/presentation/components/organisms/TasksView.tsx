import React from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { groupPosition } from '../atoms/GroupedRow';
import { EmptyState } from '../molecules/EmptyState';
import { TaskRow, type TaskRowModel } from '../molecules/TaskRow';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';

interface TasksViewProps {
  open: readonly TaskRowModel[];
  completed: readonly TaskRowModel[];
  /** The real number of completed tasks, which may exceed `completed`. */
  completedTotal: number;
  completing: ReadonlySet<string>;
  completedExpanded: boolean;
  onToggleCompleted: () => void;
  onToggleTask: (id: string) => void;
  onUndo: (id: string) => void;
  onOpenTask: (id: string) => void;
}

interface Section {
  key: 'open' | 'completed';
  data: readonly TaskRowModel[];
}

const makeStyles = (t: Theme) => ({
  content: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl },
  heading: {
    ...t.typography.callout,
    color: t.colors.textMuted,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.xxs,
  },
  completedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: t.minTouch,
    paddingTop: t.spacing.xs,
    gap: t.spacing.sm,
  },
  pressed: { opacity: 0.8 },
  completedTitle: {
    ...t.typography.callout,
    color: t.colors.textMuted,
    flexShrink: 1,
  },
  toggleWord: {
    ...t.typography.callout,
    color: t.colors.accentText,
    textDecorationLine: 'underline' as const,
  },
  caption: {
    ...t.typography.caption,
    color: t.colors.textMuted,
    paddingTop: t.spacing.xs,
  },
});

/** Open tasks, then a collapsed Completed section, in grouped rows. */
export function TasksView({
  open,
  completed,
  completedTotal,
  completing,
  completedExpanded,
  onToggleCompleted,
  onToggleTask,
  onUndo,
  onOpenTask,
}: TasksViewProps) {
  const styles = useStyles(makeStyles);
  const sections: Section[] = [{ key: 'open', data: open }];
  if (completedTotal > 0) {
    sections.push({
      key: 'completed',
      data: completedExpanded ? completed : [],
    });
  }
  const noTasksAtAll = open.length === 0 && completedTotal === 0;
  return (
    <SectionList<TaskRowModel, Section>
      sections={sections}
      keyExtractor={task => task.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) =>
        section.key === 'open' ? (
          <Text accessibilityRole="header" style={styles.heading}>
            Open
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Completed, ${completedTotal} ${
              completedTotal === 1 ? 'task' : 'tasks'
            }, ${completedExpanded ? 'shown' : 'hidden'}`}
            accessibilityState={{ expanded: completedExpanded }}
            onPress={onToggleCompleted}
            style={({ pressed }) => [
              styles.completedHeader,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={styles.completedTitle}
            >{`Completed (${completedTotal})`}</Text>
            <Text style={styles.toggleWord}>
              {completedExpanded ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        )
      }
      renderItem={({ item, index, section }) => (
        <TaskRow
          task={item}
          completing={completing.has(item.id)}
          position={groupPosition(index, section.data.length)}
          onToggle={() => onToggleTask(item.id)}
          onUndo={() => onUndo(item.id)}
          onOpen={() => onOpenTask(item.id)}
        />
      )}
      renderSectionFooter={({ section }) => {
        if (section.key === 'open' && open.length === 0) {
          return noTasksAtAll ? (
            <EmptyState
              title="No tasks yet"
              body="Add your first task above."
            />
          ) : (
            <EmptyState title="Nothing open" body="Everything here is done." />
          );
        }
        if (
          section.key === 'completed' &&
          completedExpanded &&
          completedTotal > completed.length
        ) {
          return (
            <View>
              <Text style={styles.caption}>
                {`Showing the latest ${completed.length} of ${completedTotal}.`}
              </Text>
            </View>
          );
        }
        return null;
      }}
    />
  );
}
