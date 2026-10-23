import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Frame } from '../components/atoms/Screen';
import { InlineMessage } from '../components/atoms/InlineMessage';
import { MessageView } from '../components/molecules/MessageView';
import { TaskDetailView } from '../components/organisms/TaskDetailView';
import { errorSentence } from '../errorMessages';
import { dueDateTimeText } from '../format/dueText';
import { useI18n } from '../i18n/I18nProvider';
import { useReduceMotion } from '../hooks/useReduceMotion';
import type { ScreenProps } from '../navigation/routes';
import {
  useCompleting,
  useLiveQuery,
  useNotice,
  useNow,
  usePlanner,
} from '../plannerContext';
import { remainingMs, timerProgress } from '@/domain';

/** The ring card ticks this often while a task runs, or this often with reduced motion. */
const TICK_MS = 1_000;
const REDUCED_TICK_MS = 30_000;

/**
 * Task detail: the destination of a task card. The ring card ticks while the
 * task runs (every second, every 30 seconds with reduced motion) and holds
 * still otherwise. Start and Pause write at once (guarded against double
 * taps); Complete uses the same five second undo window as the lists, since
 * the backend cannot reopen a task. Container.
 */
export function TaskDetailScreen({
  navigation,
  route,
}: ScreenProps<'TaskDetail'>) {
  const { taskId } = route.params;
  const planner = usePlanner();
  const i18n = useI18n();
  const { t } = i18n;
  const detail = useLiveQuery(p => p.queries.watchTaskDetail(taskId), [taskId]);
  const completing = useCompleting();
  const notice = useNotice();
  const reduceMotion = useReduceMotion();
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const data = detail.status === 'loading' ? undefined : detail.data;
  const task = data?.task;
  const inWindow = completing.has(taskId);
  const running = task?.status === 'in_progress' && !inWindow;
  const now = useNow(
    running ? (reduceMotion ? REDUCED_TICK_MS : TICK_MS) : null,
  );
  const goBack = () => navigation.goBack();

  if (leaving || detail.status === 'loading') {
    return null;
  }
  if (detail.status === 'error' && !data) {
    return (
      <Frame>
        <MessageView
          title={t('taskDetailLoadError')}
          action={{ label: t('back'), onPress: goBack }}
        />
      </Frame>
    );
  }
  if (!task || !data) {
    return (
      <Frame>
        <MessageView
          title={t('taskGoneTitle')}
          body={t('taskGoneBody')}
          action={{ label: t('back'), onPress: goBack }}
        />
      </Frame>
    );
  }

  async function runTimer(op: 'start' | 'pause') {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await planner.taskTimer[op](taskId);
    } finally {
      setBusy(false);
    }
  }

  /** A failed subtask write is said politely; nothing is lost silently. */
  async function guarded(write: () => Promise<unknown>) {
    try {
      await write();
    } catch {
      planner.notices.announce({ key: 'errorSave' });
    }
  }

  async function addSubtask(title: string): Promise<string | null> {
    try {
      await planner.subtasks.add(taskId, title);
      return null;
    } catch (problem) {
      return errorSentence(problem, t);
    }
  }

  function confirmDelete() {
    Alert.alert(t('taskDeleteConfirm'), t('taskDeleteHint'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          try {
            await planner.tasks.remove(taskId);
            goBack();
          } catch {
            setLeaving(false);
            planner.notices.announce({ key: 'errorSave' });
          }
        },
      },
    ]);
  }

  return (
    <Frame>
      <TaskDetailView
        task={{
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueText:
            task.dueDate === null
              ? null
              : dueDateTimeText(task.dueDate, task.dueAllDay, now, i18n),
          timer:
            task.durationMs === null
              ? null
              : {
                  progress: timerProgress(task, now),
                  remainingMs: remainingMs(task, now),
                },
        }}
        subtasks={data.subtasks.map(s => ({
          id: s.id,
          title: s.title,
          completed: s.completed,
        }))}
        completing={inWindow}
        busy={busy}
        notice={notice}
        onBack={goBack}
        onEdit={() => navigation.navigate('TaskEdit', { taskId })}
        onDelete={confirmDelete}
        onStart={() => runTimer('start')}
        onPause={() => runTimer('pause')}
        onComplete={() => planner.completion.begin(task)}
        onUndo={() => planner.completion.undo(taskId)}
        onToggleSubtask={(id, completed) =>
          guarded(() => planner.subtasks.setCompleted(id, completed))
        }
        onDeleteSubtask={id => guarded(() => planner.subtasks.remove(id))}
        onAddSubtask={addSubtask}
      />
      {detail.status === 'error' ? (
        <InlineMessage kind="error" message={t('taskDetailLoadError')} />
      ) : null}
    </Frame>
  );
}
