import type { Event } from '@/domain';
import { addDays, startOfLocalDay, toDateInputValue } from './localDate';

const DAY_MS = 86_400_000;

/**
 * Whole local days from the day holding `nowMs` to the day holding
 * `targetMs`; negative for the past. Counted between local midnights and
 * rounded, so the 23 and 25 hour days of a DST change do not shift it.
 */
export function daysUntil(targetMs: number, nowMs: number): number {
  return Math.round(
    (startOfLocalDay(targetMs) - startOfLocalDay(nowMs)) / DAY_MS,
  );
}

export interface UpcomingReminder<T> {
  event: T;
  /** 1 tomorrow; never 0, see upcomingReminders. */
  daysLeft: number;
}

/**
 * The events flagged as reminders that start tomorrow or later, soonest first
 * (the given order for equal starts), each with the days left. On its own day
 * an event is already among today's events, so it is not repeated here.
 */
export function upcomingReminders<T extends Pick<Event, 'startAt' | 'remind'>>(
  events: readonly T[],
  nowMs: number,
): UpcomingReminder<T>[] {
  return events
    .filter(event => event.remind && event.startAt > 0)
    .map(event => ({ event, daysLeft: daysUntil(event.startAt, nowMs) }))
    .filter(reminder => reminder.daysLeft > 0)
    .sort((a, b) => a.event.startAt - b.event.startAt);
}

/** "2027-01-10": the local date `n` days after the day holding `nowMs`. */
export function dateInDays(nowMs: number, n: number): string {
  return toDateInputValue(addDays(startOfLocalDay(nowMs), n));
}
