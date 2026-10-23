import { remainingMs, timerProgress, type Task } from '@/domain';
import type { TaskCardModel } from '../components/molecules/TaskCard';
import type { I18n } from '../i18n/I18nProvider';
import { dueText } from './dueText';

/** What a task card shows, from a task at one moment. */
export function taskCardModel(
  task: Task,
  now: number,
  i18n: I18n,
): TaskCardModel {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    due: dueText(task, now, i18n),
    timer:
      task.durationMs === null
        ? null
        : {
            progress: timerProgress(task, now),
            remainingMs: remainingMs(task, now),
          },
  };
}
