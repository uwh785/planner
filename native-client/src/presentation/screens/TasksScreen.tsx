import React, { useState } from 'react';
import { Frame } from '../components/atoms/Screen';
import { ColorDot } from '../components/atoms/ColorDot';
import { InlineMessage } from '../components/atoms/InlineMessage';
import { Announcement } from '../components/molecules/Announcement';
import {
  FilterChips,
  type ChipOption,
} from '../components/molecules/FilterChips';
import { QuickAddField } from '../components/molecules/QuickAddField';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import {
  TasksView,
  type CompletedMode,
} from '../components/organisms/TasksView';
import { errorSentence } from '../errorMessages';
import { taskCardModel } from '../format/taskCardModel';
import { useFlushCompletionOnLeave } from '../hooks/useFlushCompletionOnLeave';
import { useI18n } from '../i18n/I18nProvider';
import type { TabScreenProps } from '../navigation/routes';
import {
  useCompleting,
  useLiveQuery,
  useNotice,
  useNow,
  usePlanner,
} from '../plannerContext';
import type { StatusFilter } from '@/application/planner/PlannerQueries';

/** Time-dependent text (due, overdue, time left) is refreshed this often. */
const REFRESH_MS = 30_000;

const COMPLETED_MODE: Record<StatusFilter, CompletedMode> = {
  all: 'collapsible',
  pending: 'none',
  in_progress: 'none',
  overdue: 'none',
  completed: 'open',
};

/** Tasks: quick add, the web's status filters, a list filter, the cards. Container. */
export function TasksScreen({ navigation }: TabScreenProps<'Tasks'>) {
  const i18n = useI18n();
  const { t } = i18n;
  const planner = usePlanner();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [pickedList, setPickedList] = useState<string | undefined>(undefined);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const overview = useLiveQuery(p => p.queries.watchOverview(), []);
  const lists = overview.status === 'loading' ? [] : overview.data?.lists ?? [];
  // A list that was deleted meanwhile drops back to every list.
  const listId =
    pickedList !== undefined &&
    (overview.status === 'loading' ||
      lists.some(({ list }) => list.id === pickedList))
      ? pickedList
      : undefined;
  const sections = useLiveQuery(
    p => p.queries.watchTasks({ listId, status }),
    [listId, status],
  );
  const completing = useCompleting();
  const notice = useNotice();
  const now = useNow(REFRESH_MS);
  const data = sections.status === 'loading' ? null : sections.data;
  const { completion } = planner;

  // Leaving the screen (or just its tab) completes what is still in its undo window.
  useFlushCompletionOnLeave();

  async function addTask(text: string): Promise<string | null> {
    try {
      await planner.tasks.addQuick(text, listId ?? null);
      return null;
    } catch (error) {
      return errorSentence(error, t);
    }
  }

  function completeTask(id: string) {
    const task = data?.open.find(candidate => candidate.id === id);
    if (task) {
      completion.begin(task);
    }
  }

  const statusOptions: ChipOption<StatusFilter>[] = [
    { value: 'all', label: t('tasksAll') },
    { value: 'pending', label: t('tasksPending') },
    { value: 'in_progress', label: t('tasksInProgress') },
    { value: 'completed', label: t('tasksCompleted') },
    { value: 'overdue', label: t('dashboardOverdue') },
  ];
  const listOptions: ChipOption<string>[] = [
    { value: '', label: t('tasksAll'), leading: <ColorDot color={null} /> },
    ...lists.map(({ list }) => ({
      value: list.id,
      label: list.name,
      leading: <ColorDot color={list.color} />,
    })),
  ];

  const header = (
    <>
      <ScreenHeader title={t('tasksTitle')} />
      <QuickAddField label={t('taskQuickAdd')} onSubmit={addTask} />
      <Announcement notice={notice} />
      <FilterChips
        label={t('tasksFilterStatus')}
        options={statusOptions}
        value={status}
        onChange={next => {
          setStatus(next);
          setCompletedExpanded(false);
        }}
      />
      {lists.length > 0 ? (
        <FilterChips
          label={t('tasksFilterList')}
          options={listOptions}
          value={listId ?? ''}
          onChange={next => setPickedList(next === '' ? undefined : next)}
        />
      ) : null}
      {sections.status === 'error' && !data ? (
        <InlineMessage kind="error" message={t('tasksLoadError')} />
      ) : null}
    </>
  );

  return (
    <Frame>
      <TasksView
        header={header}
        open={(data?.open ?? []).map(task => taskCardModel(task, now, i18n))}
        completed={(data?.completed ?? []).map(task =>
          taskCardModel(task, now, i18n),
        )}
        completedTotal={data?.completedTotal ?? 0}
        completedMode={COMPLETED_MODE[status]}
        filtered={status !== 'all'}
        completing={completing}
        completedExpanded={completedExpanded}
        onToggleCompleted={() => setCompletedExpanded(open => !open)}
        onStartTask={id => {
          planner.taskTimer.start(id);
        }}
        onPauseTask={id => {
          planner.taskTimer.pause(id);
        }}
        onCompleteTask={completeTask}
        onUndo={id => completion.undo(id)}
        onOpenTask={taskId => navigation.navigate('TaskDetail', { taskId })}
      />
    </Frame>
  );
}
