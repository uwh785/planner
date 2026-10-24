import type { Event, Task } from '@/domain';
import { eventDayKeys, sortEvents } from './eventDays';
import { toDateInputValue } from './localDate';

/** The start of the month and of the next one: a half-open range. */
export function monthBounds(
  year: number,
  month: number,
): { from: number; to: number } {
  return {
    from: new Date(year, month, 1).getTime(),
    to: new Date(year, month + 1, 1).getTime(),
  };
}

/** `month` is 0 to 11; moves across year boundaries. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export interface MonthCell {
  /** 1 to 31. */
  day: number;
  /** Local midnight of the day. */
  dayStart: number;
  /** Events occupying the day, sorted. */
  events: Event[];
  /** Tasks due in [dayStart, dayStart + 24 h), as the web counts them. */
  tasks: Task[];
}

const DAY_MS = 86_400_000;

/**
 * The month as weeks of seven, Sunday first, blank (null) before the 1st
 * and after the last day. Events appear under every day they span.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  events: readonly Event[],
  tasks: readonly Task[],
): (MonthCell | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = new Date(year, month, 1).getDay();
  const byDay = new Map<string, Event[]>();
  for (const event of events) {
    for (const key of eventDayKeys(event)) {
      const list = byDay.get(key);
      if (list) {
        list.push(event);
      } else {
        byDay.set(key, [event]);
      }
    }
  }
  const cells: (MonthCell | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayStart = new Date(year, month, day).getTime();
    cells.push({
      day,
      dayStart,
      events: sortEvents(byDay.get(toDateInputValue(dayStart)) ?? []),
      tasks: tasks.filter(
        t =>
          t.dueDate !== null &&
          t.dueDate >= dayStart &&
          t.dueDate < dayStart + DAY_MS,
      ),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (MonthCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
