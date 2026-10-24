import type { MessageKey } from '@/application/i18n';
import type { MonthCell } from '@/application/calendar/monthGrid';
import type { Translate } from '../i18n/I18nProvider';
import { monthNames } from './eventCardModel';

/** Chips and dots a cell draws before it writes "+N". */
export const CELL_MARKS = 3;

export interface MonthCellModel {
  day: number;
  dayStart: number;
  /** Colors of the first event chips (empty string = the accent). */
  chips: string[];
  /** Events beyond the chips. */
  moreEvents: number;
  /** Task dots drawn (at most `CELL_MARKS`). */
  dots: number;
  moreTasks: number;
  today: boolean;
  selected: boolean;
  /** "October 22, 2026, today, 2 events, 1 task", for TalkBack. */
  spoken: string;
}

export function monthCellModel(
  cell: MonthCell,
  year: number,
  month: number,
  todayStart: number,
  selectedStart: number | null,
  t: Translate,
): MonthCellModel {
  const today = cell.dayStart === todayStart;
  const parts = [
    t('calendarDayLabel', {
      day: cell.day,
      month: monthNames(t)[month] ?? '',
      year,
    }),
  ];
  if (today) {
    parts.push(t('calendarToday'));
  }
  if (cell.events.length > 0) {
    parts.push(t('calendarDayEvents', { count: cell.events.length }));
  }
  if (cell.tasks.length > 0) {
    parts.push(t('calendarDayTasks', { count: cell.tasks.length }));
  }
  return {
    day: cell.day,
    dayStart: cell.dayStart,
    chips: cell.events.slice(0, CELL_MARKS).map(e => e.color),
    moreEvents: Math.max(cell.events.length - CELL_MARKS, 0),
    dots: Math.min(cell.tasks.length, CELL_MARKS),
    moreTasks: Math.max(cell.tasks.length - CELL_MARKS, 0),
    today,
    selected: cell.dayStart === selectedStart,
    spoken: parts.join(', '),
  };
}

export const weekdayKey = (dow: number): MessageKey =>
  `scheduleDayName${dow}` as MessageKey;
