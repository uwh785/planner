import type { ClassSession } from '@/domain';
import { minuteOfDay, weekdayOf } from '@/application/schedule/scheduleTime';
import { splitTodayClasses } from '@/application/schedule/todayClasses';
import type { I18n } from '../i18n/I18nProvider';
import { classCardModel } from './classCardModel';
import { formatDuration } from './duration';

/** Where a class stands against the current minute. */
export type TodayClassState = 'done' | 'current' | 'next' | 'later';

export interface TodayClassModel {
  id: string;
  subject: string;
  color: string;
  state: TodayClassState;
  /** "Ends in 25 min" for the current class, "Starts in 1 h" for the next; else empty. */
  countdown: string;
  /** 0 to 1, how much of the current class has passed; 0 otherwise. */
  progress: number;
  /** "08:00 – 09:00 · A1, Ruiz": the range, then room and teacher when set. */
  detail: string;
  /** The whole row for a screen reader: "INGLÉS, Finished, 08:00 – 09:00, A1, Ruiz". */
  spoken: string;
}

export interface TodayClassesModel {
  /** Every class of the day, by start time, the ended ones included. */
  items: TodayClassModel[];
}

const MINUTE_MS = 60_000;

/**
 * Today's whole timetable at one moment: each class with its time, room and
 * teacher, the one in progress and the next with their countdowns, and the
 * ended ones marked as done. Null when the day has none (the Panel then shows
 * no block at all).
 */
export function todayClassesModel(
  classes: readonly ClassSession[],
  now: number,
  { t }: I18n,
): TodayClassesModel | null {
  const today = classes
    .filter(c => c.dayOfWeek === weekdayOf(now))
    .sort((a, b) => a.startMinute - b.startMinute);
  if (today.length === 0) {
    return null;
  }
  const minute = minuteOfDay(now);
  const { current, next } = splitTodayClasses(today, minute);

  const items = today.map((c): TodayClassModel => {
    const card = classCardModel(c);
    let state: TodayClassState = 'later';
    let countdown = '';
    let progress = 0;
    if (c === current) {
      state = 'current';
      countdown = `${t('scheduleEndsIn')} ${formatDuration(
        (c.endMinute - minute) * MINUTE_MS,
        t,
      )}`;
      progress = Math.min(
        Math.max((minute - c.startMinute) / (c.endMinute - c.startMinute), 0),
        1,
      );
    } else if (c === next) {
      state = 'next';
      countdown = `${t('scheduleStartsIn')} ${formatDuration(
        (c.startMinute - minute) * MINUTE_MS,
        t,
      )}`;
    } else if (c.endMinute <= minute) {
      state = 'done';
    }
    const status = state === 'done' ? t('scheduleClassDone') : countdown;
    return {
      id: c.id,
      subject: c.subject,
      color: c.color,
      state,
      countdown,
      progress,
      detail: [card.time, card.place].filter(Boolean).join(' · '),
      spoken: [c.subject, status, card.time, card.place]
        .filter(Boolean)
        .join(', '),
    };
  });
  return { items };
}
