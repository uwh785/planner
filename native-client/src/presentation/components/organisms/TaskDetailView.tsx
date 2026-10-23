import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { Priority, TaskStatus } from '@/domain';
import type { MessageKey, MessageRef } from '@/application/i18n';
import { Flag } from '../atoms/icons';
import { StatusDot } from '../atoms/StatusDot';
import { Announcement } from '../molecules/Announcement';
import { DetailHeader } from '../molecules/DetailHeader';
import { InfoPair } from '../molecules/InfoPair';
import { usePriorityWord } from '../molecules/PriorityBadge';
import { TimerActions } from '../molecules/TimerActions';
import { TimerBox, type TimerModel } from '../molecules/TimerBox';
import { UndoBar } from '../molecules/UndoBar';
import { SubtaskSection, type SubtaskModel } from './SubtaskSection';
import { useT } from '../../i18n/I18nProvider';
import { useStyles, useTheme } from '../../theme';
import type { Theme } from '../../theme';

/** What the detail screen shows of a task; no repository types leak in. */
export interface TaskDetailModel {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  /** The due moment in words, or null when there is none. */
  dueText: string | null;
  /** Present when the task has a duration. */
  timer: TimerModel | null;
}

interface TaskDetailViewProps {
  task: TaskDetailModel;
  subtasks: readonly SubtaskModel[];
  /** In the undo window: the actions give way to "Completed" and Undo. */
  completing: boolean;
  /** A timer write is under way. */
  busy: boolean;
  notice: { id: number; message: MessageRef } | null;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
  onPause: () => void;
  onComplete: () => void;
  onUndo: () => void;
  onToggleSubtask: (id: string, completed: boolean) => void;
  onDeleteSubtask: (id: string) => void;
  onAddSubtask: (title: string) => Promise<string | null>;
}

const STATUS_WORD: Record<TaskStatus, MessageKey> = {
  pending: 'taskStatusPending',
  in_progress: 'taskStatusInProgress',
  completed: 'taskStatusCompleted',
};

const makeStyles = (t: Theme) => ({
  content: { paddingBottom: t.spacing.xxl },
  body: { paddingHorizontal: t.spacing.lg, gap: t.spacing.lg },
  description: { ...t.typography.body, color: t.colors.textMuted },
  info: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: t.spacing.md,
  },
});

/**
 * The web's task detail on a phone: the header with Edit and Delete, the
 * description, Priority and Status, the ring card with the time left, the
 * timer actions and the subtasks. Props in, callbacks out.
 */
export function TaskDetailView({
  task,
  subtasks,
  completing,
  busy,
  notice,
  onBack,
  onEdit,
  onDelete,
  onStart,
  onPause,
  onComplete,
  onUndo,
  onToggleSubtask,
  onDeleteSubtask,
  onAddSubtask,
}: TaskDetailViewProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const priorityWord = usePriorityWord(task.priority);
  const priorityColor = [
    colors.priority.none,
    colors.priority.low,
    colors.priority.medium,
    colors.priority.high,
  ][task.priority]!;
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <DetailHeader
        title={task.title}
        onBack={onBack}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <Announcement notice={notice} />
      <View style={styles.body}>
        {task.description !== '' ? (
          <Text style={styles.description}>{task.description}</Text>
        ) : null}
        <View style={styles.info}>
          {priorityWord !== null ? (
            <InfoPair
              label={t('taskPriority')}
              value={priorityWord}
              leading={
                <Flag size={14} strokeWidth={2.5} color={priorityColor} />
              }
            />
          ) : null}
          {task.dueText !== null ? (
            <InfoPair label={t('taskDueDate')} value={task.dueText} />
          ) : null}
          <InfoPair
            label={t('taskStatus')}
            value={t(STATUS_WORD[task.status])}
            leading={<StatusDot status={task.status} />}
          />
        </View>
        {task.timer !== null ? (
          <TimerBox variant="card" status={task.status} timer={task.timer} />
        ) : null}
        {completing ? (
          <UndoBar onUndo={onUndo} />
        ) : (
          <TimerActions
            status={task.status}
            title={task.title}
            busy={busy}
            onStart={onStart}
            onPause={onPause}
            onComplete={onComplete}
          />
        )}
        <SubtaskSection
          subtasks={subtasks}
          onToggle={onToggleSubtask}
          onDelete={onDeleteSubtask}
          onAdd={onAddSubtask}
        />
      </View>
    </ScrollView>
  );
}
