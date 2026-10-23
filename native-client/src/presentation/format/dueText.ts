import { isOverdue, type Task } from '@/domain';
import type { I18n } from '../i18n/I18nProvider';
import { dateText, timeText } from './dates';

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** The date, and the time for a timed due moment: "Dec 3" or "Dec 3, 14:30". */
export function dueDateTimeText(
  ms: number,
  allDay: boolean,
  now: number,
  { locale, t }: I18n,
): string {
  const day = dateText(ms, now, locale);
  return allDay ? day : t('dueWithTime', { day, time: timeText(ms, locale) });
}

export interface DueText {
  text: string;
  overdue: boolean;
}

type DueFields = Pick<Task, 'status' | 'dueDate' | 'dueAllDay' | 'completedAt'>;

/**
 * The short line under a task title. Overdue is spelled out ("Overdue, Oct
 * 20") so it never relies on color; a completed task shows when it was
 * completed instead of a due date.
 */
export function dueText(
  task: DueFields,
  now: number,
  i18n: I18n,
): DueText | null {
  const { locale, t } = i18n;
  if (task.status === 'completed' && task.completedAt !== null) {
    return {
      text: t('dueCompleted', {
        date: dateText(task.completedAt, now, locale),
      }),
      overdue: false,
    };
  }
  if (task.dueDate === null) {
    return null;
  }
  const absolute = dueDateTimeText(task.dueDate, task.dueAllDay, now, i18n);
  if (isOverdue(task, now)) {
    return { text: t('dueOverdue', { date: absolute }), overdue: true };
  }
  const days = Math.round(
    (startOfDay(task.dueDate) - startOfDay(now)) / 86_400_000,
  );
  const dayKey = days === 0 ? 'dateToday' : days === 1 ? 'dateTomorrow' : null;
  if (dayKey === null) {
    return { text: absolute, overdue: false };
  }
  const word = t(dayKey);
  return {
    text: task.dueAllDay
      ? word
      : t('dueWithTime', { day: word, time: timeText(task.dueDate, locale) }),
    overdue: false,
  };
}
