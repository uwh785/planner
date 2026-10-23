import React, { useEffect, useState } from 'react';
import { Frame } from '../components/atoms/Screen';
import { Announcement } from '../components/molecules/Announcement';
import { MessageView } from '../components/molecules/MessageView';
import { QuickAddField } from '../components/molecules/QuickAddField';
import { ScreenHeader } from '../components/molecules/ScreenHeader';
import type { TaskRowModel } from '../components/molecules/TaskRow';
import { TasksView } from '../components/organisms/TasksView';
import { dueText } from '../format/dueText';
import type { ScreenProps } from '../navigation/routes';
import {
  errorSentence,
  useCompleting,
  useLiveQuery,
  useNotice,
  usePlanner,
} from '../plannerContext';
import type { Task } from '@/domain';

const rowModel = (task: Task, now: number): TaskRowModel => ({
  id: task.id,
  title: task.title,
  completed: task.status === 'completed',
  due: dueText(task, now),
  priority: task.priority,
});

/** Tasks of one list, or of all lists. Container. */
export function TasksScreen({ navigation, route }: ScreenProps<'Tasks'>) {
  const listId = route.params?.listId;
  const planner = usePlanner();
  const sections = useLiveQuery(
    p => p.queries.watchTasks({ listId }),
    [listId],
  );
  const list = useLiveQuery(p => p.queries.watchList(listId ?? ''), [listId]);
  const completing = useCompleting();
  const notice = useNotice();
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const { completion } = planner;

  // Leaving the screen completes what is still in its undo window.
  useEffect(
    () => () => {
      completion.flush();
    },
    [completion],
  );

  const goBack = () => navigation.goBack();
  if (listId !== undefined && list.status === 'ready' && list.data === null) {
    return (
      <MessageView
        title="This list no longer exists"
        body="It was deleted. Its tasks are still in All tasks."
        action={{ label: 'Back to lists', onPress: goBack }}
      />
    );
  }

  const title =
    listId === undefined
      ? 'All tasks'
      : list.status === 'ready' && list.data
      ? list.data.name
      : '';
  const now = planner.now();
  const data = sections.status === 'loading' ? null : sections.data;

  async function addTask(text: string): Promise<string | null> {
    try {
      await planner.tasks.addQuick(text, listId ?? null);
      return null;
    } catch (error) {
      return errorSentence(error);
    }
  }

  function toggle(id: string) {
    if (completion.has(id)) {
      completion.undo(id);
      return;
    }
    const task = data?.open.find(t => t.id === id);
    if (task) {
      completion.begin(task);
    }
  }

  return (
    <Frame>
      <ScreenHeader
        title={title}
        onBack={goBack}
        actions={
          listId === undefined
            ? []
            : [
                {
                  label: 'Edit list',
                  onPress: () => navigation.navigate('ListEdit', { listId }),
                },
              ]
        }
      />
      <QuickAddField label="Add a task" onSubmit={addTask} />
      <Announcement notice={notice} />
      {data ? (
        <TasksView
          open={data.open.map(t => rowModel(t, now))}
          completed={data.completed.map(t => rowModel(t, now))}
          completedTotal={data.completedTotal}
          completing={completing}
          completedExpanded={completedExpanded}
          onToggleCompleted={() => setCompletedExpanded(open => !open)}
          onToggleTask={toggle}
          onUndo={id => completion.undo(id)}
          onOpenTask={taskId => navigation.navigate('TaskEdit', { taskId })}
        />
      ) : null}
    </Frame>
  );
}
