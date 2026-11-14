import type { Event } from '@/domain';
import { formatShortDate } from '@/application/calendar/eventDays';
import { upcomingReminders } from '@/application/calendar/reminders';
import type { Translate } from '../i18n/I18nProvider';
import { monthNames } from './eventCardModel';

/** What a reminder row shows; no repository types leak into the component. */
export interface ReminderModel {
  id: string;
  title: string;
  /** "10 jan": the day the event starts. */
  date: string;
  /** "29 days left" or "Tomorrow". */
  countdown: string;
  daysLeft: number;
  /** The event's own color, or empty to take the accent. */
  color: string;
  /** The whole row for a screen reader: "Recharge, 10 jan, 29 days left". */
  spoken: string;
}

function countdownText(daysLeft: number, t: Translate): string {
  if (daysLeft === 1) {
    return t('dateTomorrow');
  }
  return t('reminderDaysLeft', { count: daysLeft });
}

/**
 * The Panel's reminders: flagged events from tomorrow on, soonest first. Empty
 * when there are none (the Panel then shows no block at all).
 */
export function remindersModel(
  events: readonly Event[],
  now: number,
  t: Translate,
): ReminderModel[] {
  const months = monthNames(t);
  return upcomingReminders(events, now).map(({ event, daysLeft }) => {
    const date = formatShortDate(event.startAt, months);
    const countdown = countdownText(daysLeft, t);
    return {
      id: event.id,
      title: event.title,
      date,
      countdown,
      daysLeft,
      color: event.color,
      spoken: [event.title, date, countdown].join(', '),
    };
  });
}
