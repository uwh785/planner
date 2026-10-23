import { isOverdue, type Task } from '@/domain';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]; // prettier-ignore

const pad = (n: number): string => String(n).padStart(2, '0');

const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** "Dec 3", or "Dec 3, 2027" when it is not this year. */
export function dateText(ms: number, now: number): string {
  const d = new Date(ms);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date(now).getFullYear()
    ? base
    : `${base}, ${d.getFullYear()}`;
}

/** 24-hour "14:30", like the web app. */
export function timeText(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The date, and the time for a timed due moment: "Dec 3" or "Dec 3, 14:30". */
export function dueDateTimeText(ms: number, allDay: boolean, now: number): string {
  return allDay
    ? dateText(ms, now)
    : `${dateText(ms, now)}, ${timeText(ms)}`;
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
export function dueText(task: DueFields, now: number): DueText | null {
  if (task.status === 'completed' && task.completedAt !== null) {
    return { text: `Completed ${dateText(task.completedAt, now)}`, overdue: false };
  }
  if (task.dueDate === null) {
    return null;
  }
  const absolute = dueDateTimeText(task.dueDate, task.dueAllDay, now);
  if (isOverdue(task, now)) {
    return { text: `Overdue, ${absolute}`, overdue: true };
  }
  const days = Math.round(
    (startOfDay(task.dueDate) - startOfDay(now)) / 86_400_000,
  );
  const word = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : null;
  if (word === null) {
    return { text: absolute, overdue: false };
  }
  return {
    text: task.dueAllDay ? word : `${word}, ${timeText(task.dueDate)}`,
    overdue: false,
  };
}
