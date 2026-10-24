import type { Event } from '@/domain';
import { eventsOnDay } from '@/application/calendar/eventDays';
import type { Translate } from '../i18n/I18nProvider';
import { eventCardModel, type EventCardModel } from './eventCardModel';

/**
 * Today's events, all-day first, as cards. Empty when the day has none (the
 * Panel then shows no block at all).
 */
export function todayEventsModel(
  events: readonly Event[],
  now: number,
  t: Translate,
): EventCardModel[] {
  return eventsOnDay(events, now).map(event => eventCardModel(event, t));
}
