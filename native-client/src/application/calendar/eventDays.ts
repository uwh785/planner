import type { Event } from '@/domain';
import type { MessageKey } from '../i18n';
import {
  addDays,
  combineLocalDateTime,
  fromDateInputValue,
  isSameLocalDay,
  startOfLocalDay,
  toDateInputValue,
  toTimeInputValue,
} from './localDate';

/** The part of an event that decides which days it occupies. */
export type EventSpan = Pick<Event, 'startAt' | 'endAt'>;

/**
 * Local midnight of the last day an event occupies (web utils.js). The end
 * is exclusive, so an event ending exactly at midnight does not spill into
 * that day; one without an end occupies only its start day.
 */
export function eventLastDayStart(event: EventSpan): number {
  const { startAt, endAt } = event;
  const last = endAt !== null && endAt > startAt ? endAt - 1 : startAt;
  return startOfLocalDay(last);
}

/**
 * "YYYY-MM-DD" keys of every local day the event spans, in order. Capped so
 * a malformed range can never loop for long.
 */
export function eventDayKeys(event: EventSpan, maxDays = 366): string[] {
  if (!event.startAt) {
    return [];
  }
  const keys: string[] = [];
  const lastDay = eventLastDayStart(event);
  let day = startOfLocalDay(event.startAt);
  while (day <= lastDay && keys.length < maxDays) {
    keys.push(toDateInputValue(day));
    day = addDays(day, 1);
  }
  return keys;
}

/** By day, all-day events first within their own day, then by start time. */
export function sortEvents<T extends Pick<Event, 'startAt' | 'allDay'>>(
  events: readonly T[],
): T[] {
  return [...events].sort((a, b) => {
    const dayDiff = startOfLocalDay(a.startAt) - startOfLocalDay(b.startAt);
    if (dayDiff !== 0) {
      return dayDiff;
    }
    if (a.allDay !== b.allDay) {
      return a.allDay ? -1 : 1;
    }
    return a.startAt - b.startAt;
  });
}

/** The events occupying the local day that holds `dayMs`, sorted. */
export function eventsOnDay<T extends Event>(
  events: readonly T[],
  dayMs: number,
): T[] {
  const dayStart = startOfLocalDay(dayMs);
  return sortEvents(
    events.filter(
      e =>
        e.startAt > 0 &&
        startOfLocalDay(e.startAt) <= dayStart &&
        eventLastDayStart(e) >= dayStart,
    ),
  );
}

/** "YYYY-MM-DD" to the sorted events on it; multi-day events repeat. */
export function groupEventsByDay<T extends Event>(
  events: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const event of events) {
    for (const key of eventDayKeys(event)) {
      const list = map.get(key);
      if (list) {
        list.push(event);
      } else {
        map.set(key, [event]);
      }
    }
  }
  for (const [key, list] of map) {
    map.set(key, sortEvents(list));
  }
  return map;
}

/** "5 mar": the day and the lower-cased short month name. */
export function formatShortDate(
  ms: number,
  monthNames: readonly string[],
): string {
  if (!ms) {
    return '';
  }
  const d = new Date(ms);
  return `${d.getDate()} ${(monthNames[d.getMonth()] ?? '').toLowerCase()}`;
}

/**
 * The time label of an event: the all-day label; "HH:MM" without an end;
 * "HH:MM – HH:MM" in one day; "HH:MM – 7 mar HH:MM" when it ends later.
 */
export function formatEventTime(
  event: Pick<Event, 'startAt' | 'endAt' | 'allDay'>,
  allDayLabel: string,
  monthNames: readonly string[],
): string {
  if (event.allDay) {
    return allDayLabel;
  }
  const start = toTimeInputValue(event.startAt);
  if (event.endAt === null) {
    return start;
  }
  const end = toTimeInputValue(event.endAt);
  if (isSameLocalDay(event.startAt, event.endAt)) {
    return `${start} – ${end}`;
  }
  return `${start} – ${formatShortDate(event.endAt, monthNames)} ${end}`;
}

export interface EventTimes {
  startAt: number;
  endAt: number | null;
}

/**
 * Start and end (epoch ms) from the form: an all-day event starts at local
 * midnight and has no end; a timed one needs a start time, and its optional
 * end is on the same date. Null when the date or start time is missing.
 */
export function eventTimesFromInputs(
  dateText: string,
  allDay: boolean,
  startTime: string,
  endTime: string,
): EventTimes | null {
  if (allDay) {
    const startAt = fromDateInputValue(dateText);
    return startAt === null ? null : { startAt, endAt: null };
  }
  if (!startTime) {
    return null;
  }
  const startAt = combineLocalDateTime(dateText, startTime);
  if (startAt === null) {
    return null;
  }
  const endAt = endTime ? combineLocalDateTime(dateText, endTime) : null;
  return { startAt, endAt };
}

/** The backend's rule: an event may end when it starts, never before. */
export function isEventEndValid(times: EventTimes | null): boolean {
  return times === null || times.endAt === null || times.endAt >= times.startAt;
}

/**
 * The message for a failed event save, from the HTTP status the web reads:
 * 409 is the storage ceiling, 413 an oversized body, 400 a refused field.
 * Natively a save is local and never meets a status; the keys stay in the
 * catalog for the day the sync surfaces them.
 */
export function eventErrorKey(status: number | undefined): MessageKey {
  if (status === 409) {
    return 'eventStorageLimit';
  }
  if (status === 413) {
    return 'eventTooLarge';
  }
  if (status === 400) {
    return 'eventInvalid';
  }
  return 'eventSaveError';
}
