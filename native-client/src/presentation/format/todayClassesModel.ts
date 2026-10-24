import type { ClassSession } from '@/domain';
import {
  formatTimeRange,
  minuteOfDay,
  weekdayOf,
} from '@/application/schedule/scheduleTime';
import { splitTodayClasses } from '@/application/schedule/todayClasses';
import type { I18n } from '../i18n/I18nProvider';
import { formatDuration } from './duration';

export interface TodayClassModel {
  id: string;
  subject: string;
  color: string;
  /** "Ends in 25 min" for the current class, "Starts in 1 h" for the next. */
  countdown: string;
  /** 0 to 1, how much of the current class has passed; 0 otherwise. */
  progress: number;
  /** "08:00 – 09:00". */
  time: string;
}

export interface TodayClassesModel {
  current: TodayClassModel | null;
  next: TodayClassModel | null;
  upcoming: TodayClassModel[];
}

const MINUTE_MS = 60_000;

/**
 * Today's classes at one moment, as the web's Panel words them. Null when
 * the day has none (the Panel then shows no block at all).
 */
export function todayClassesModel(
  classes: readonly ClassSession[],
  now: number,
  { t }: I18n,
): TodayClassesModel | null {
  const today = classes.filter(c => c.dayOfWeek === weekdayOf(now));
  if (today.length === 0) {
    return null;
  }
  const minute = minuteOfDay(now);
  const { current, next, upcoming } = splitTodayClasses(today, minute);
  const model = (
    c: ClassSession,
    countdown: string,
    progress: number,
  ): TodayClassModel => ({
    id: c.id,
    subject: c.subject,
    color: c.color,
    countdown,
    progress,
    time: formatTimeRange(c.startMinute, c.endMinute),
  });
  return {
    current: current
      ? model(
          current,
          `${t('scheduleEndsIn')} ${formatDuration(
            (current.endMinute - minute) * MINUTE_MS,
            t,
          )}`,
          Math.min(
            Math.max(
              (minute - current.startMinute) /
                (current.endMinute - current.startMinute),
              0,
            ),
            1,
          ),
        )
      : null,
    next: next
      ? model(
          next,
          `${t('scheduleStartsIn')} ${formatDuration(
            (next.startMinute - minute) * MINUTE_MS,
            t,
          )}`,
          0,
        )
      : null,
    upcoming: upcoming.map(c => model(c, '', 0)),
  };
}
