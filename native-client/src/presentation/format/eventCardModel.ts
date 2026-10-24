import type { Event } from '@/domain';
import { formatEventTime } from '@/application/calendar/eventDays';
import type { MessageKey } from '@/application/i18n';
import type { Translate } from '../i18n/I18nProvider';

/** What an event card shows; no repository types leak into the component. */
export interface EventCardModel {
  id: string;
  title: string;
  /** "All day", "09:00", "09:00 – 10:30" or "09:00 – 7 mar 11:00". */
  time: string;
  /** Empty when the event has no location. */
  location: string;
  /** The event's own color, or empty to take the accent. */
  color: string;
}

/** The twelve short month names, January first, in the user's language. */
export function monthNames(t: Translate): string[] {
  return Array.from({ length: 12 }, (_, i) => t(`month${i}` as MessageKey));
}

export function eventCardModel(event: Event, t: Translate): EventCardModel {
  return {
    id: event.id,
    title: event.title,
    time: formatEventTime(event, t('allDay'), monthNames(t)),
    location: event.location,
    color: event.color,
  };
}
