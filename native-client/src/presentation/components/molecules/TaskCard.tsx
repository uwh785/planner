import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Priority, TaskStatus } from '@/domain';
import type { MessageKey } from '@/application/i18n';
import { StatusDot } from '../atoms/StatusDot';
import { useT } from '../../i18n/I18nProvider';
import { useStyles } from '../../theme';
import type { Theme } from '../../theme';
import { PriorityBadge, usePriorityWord } from './PriorityBadge';
import { TimerActions } from './TimerActions';
import { TimerBox, type TimerModel } from './TimerBox';
import { UndoBar } from './UndoBar';
import { formatDuration } from '../../format/duration';

/** What a card needs to know about a task; no repository types leak in. */
export interface TaskCardModel {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  due: { text: string; overdue: boolean } | null;
  /** Present when the task has a duration. */
  timer: TimerModel | null;
}

interface TaskCardProps {
  task: TaskCardModel;
  /** In the undo window: shown as done, with an Undo action. */
  completing?: boolean;
  onOpen: () => void;
  /**
   * The timer actions: Start for a pending task, Pause for one in progress
   * (the web's card buttons), Complete for both. Each shows only when its
   * handler is given and the task is still open.
   */
  onStart?: () => void;
  onPause?: () => void;
  onComplete?: () => void;
  onUndo?: () => void;
}

const STATUS_WORD: Record<TaskStatus, MessageKey> = {
  pending: 'taskStatusPending',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
};

const makeStyles = (t: Theme) => ({
  card: {
    padding: t.spacing.md,
    borderRadius: t.radii.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    gap: t.spacing.sm,
  },
  // The web gives the active card an accent edge plus a 3dp left stripe.
  // DESIGN.md prohibits side stripes, so the whole edge takes the color.
  inProgress: { borderColor: t.colors.accent },
  overdue: { borderColor: t.colors.danger },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
  },
  title: {
    ...t.typography.body,
    fontWeight: '600' as const,
    color: t.colors.text,
    flex: 1,
  },
  done: {
    color: t.colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  due: { ...t.typography.callout, color: t.colors.textMuted },
  overdueText: { color: t.colors.danger, fontWeight: '600' as const },
  description: {
    ...t.typography.callout,
    fontWeight: '400' as const,
    color: t.colors.textMuted,
  },
  pressed: { opacity: 0.8 },
});

/**
 * The web's task card: status dot, title, priority badge, due line,
 * description, remaining-time box, then the actions. The body opens the task;
 * the Start, Pause and Complete actions and the Undo are separate controls so
 * a screen reader reaches each. Overdue and priority always carry words.
 */
export function TaskCard({
  task,
  completing = false,
  onOpen,
  onStart,
  onPause,
  onComplete,
  onUndo,
}: TaskCardProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const priorityWord = usePriorityWord(task.priority);
  const done = task.status === 'completed' || completing;
  const spoken = [
    task.title,
    t(STATUS_WORD[done ? 'completed' : task.status]),
    task.due?.text,
    priorityWord === null
      ? null
      : t('taskPriorityLabel', { level: priorityWord.toLowerCase() }),
    task.timer && !done && task.timer.progress < 1
      ? t('timerRemaining', { time: formatDuration(task.timer.remainingMs, t) })
      : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <View
      testID={`task-card-${task.id}`}
      style={[
        styles.card,
        task.status === 'in_progress'
          ? styles.inProgress
          : task.due?.overdue
          ? styles.overdue
          : null,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint={t('taskOpenHint')}
        onPress={onOpen}
        style={({ pressed }) => [{ gap: 8 }, pressed && styles.pressed]}
      >
        <View style={styles.titleRow}>
          <StatusDot status={done ? 'completed' : task.status} />
          <Text style={[styles.title, done ? styles.done : null]}>
            {task.title}
          </Text>
          <PriorityBadge priority={task.priority} />
        </View>
        {task.due ? (
          <Text
            style={[styles.due, task.due.overdue ? styles.overdueText : null]}
          >
            {task.due.text}
          </Text>
        ) : null}
        {task.description !== '' ? (
          <Text numberOfLines={2} style={styles.description}>
            {task.description}
          </Text>
        ) : null}
        {task.timer ? (
          <TimerBox status={task.status} timer={task.timer} />
        ) : null}
      </Pressable>
      {completing ? (
        <UndoBar onUndo={onUndo} />
      ) : task.status !== 'completed' && (onStart || onPause || onComplete) ? (
        <TimerActions
          variant="outlined"
          status={task.status}
          title={task.title}
          onStart={onStart}
          onPause={onPause}
          onComplete={onComplete}
        />
      ) : null}
    </View>
  );
}
