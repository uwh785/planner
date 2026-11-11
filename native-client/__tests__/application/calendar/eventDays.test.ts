import {
  eventDayKeys,
  eventErrorKey,
  eventsOnDay,
  eventTimesFromInputs,
  formatEventTime,
  formatShortDate,
  groupEventsByDay,
  isEventEndValid,
  sortEvents,
} from '@/application/calendar/eventDays';
import type { Event } from '@/domain';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m, d, h, min).getTime();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

let n = 0;
function event(patch: Partial<Event> & { startAt: number }): Event {
  n += 1;
  return {
    id: `evt_${n}`,
    title: `e${n}`,
    description: '',
    location: '',
    endAt: null,
    allDay: false,
    remind: false,
    color: '',
    updatedAt: 1,
    deleted: false,
    ...patch,
  };
}

describe('eventDayKeys', () => {
  it('is the start day when there is no end', () => {
    expect(eventDayKeys(event({ startAt: at(2026, 2, 5, 9) }))).toEqual([
      '2026-03-05',
    ]);
  });

  it('spans every day up to the one holding the last millisecond', () => {
    const multi = event({
      startAt: at(2026, 2, 5, 22),
      endAt: at(2026, 2, 7, 1),
    });
    expect(eventDayKeys(multi)).toEqual([
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
    ]);
  });

  it('treats the end as exclusive: ending at midnight does not spill', () => {
    const e = event({ startAt: at(2026, 2, 5, 20), endAt: at(2026, 2, 6) });
    expect(eventDayKeys(e)).toEqual(['2026-03-05']);
  });

  it('an end equal to the start occupies only the start day', () => {
    const t = at(2026, 2, 5, 8);
    expect(eventDayKeys(event({ startAt: t, endAt: t }))).toEqual([
      '2026-03-05',
    ]);
  });

  it('caps a malformed range', () => {
    const e = event({ startAt: at(2026, 0, 1), endAt: at(2030, 0, 1) });
    expect(eventDayKeys(e)).toHaveLength(366);
    expect(eventDayKeys(e, 3)).toHaveLength(3);
  });
});

describe('sorting and grouping', () => {
  it('sorts by day, all-day first within a day, then by start', () => {
    const late = event({ startAt: at(2026, 2, 5, 15) });
    const early = event({ startAt: at(2026, 2, 5, 8) });
    const allDay = event({ startAt: at(2026, 2, 5), allDay: true });
    const next = event({ startAt: at(2026, 2, 6), allDay: true });
    expect(sortEvents([next, late, early, allDay])).toEqual([
      allDay,
      early,
      late,
      next,
    ]);
  });

  it('lists the events occupying a day, multi-day ones included', () => {
    const one = event({ startAt: at(2026, 2, 5, 9) });
    const multi = event({
      startAt: at(2026, 2, 4, 20),
      endAt: at(2026, 2, 6, 2),
    });
    const other = event({ startAt: at(2026, 2, 7, 9) });
    const list = [one, multi, other];
    expect(eventsOnDay(list, at(2026, 2, 5, 13))).toEqual([multi, one]);
    expect(eventsOnDay(list, at(2026, 2, 7))).toEqual([other]);
    expect(eventsOnDay(list, at(2026, 2, 8))).toEqual([]);
  });

  it('groups events under every day they span', () => {
    const multi = event({
      startAt: at(2026, 2, 5, 20),
      endAt: at(2026, 2, 6, 2),
    });
    const one = event({ startAt: at(2026, 2, 6, 9) });
    const groups = groupEventsByDay([one, multi]);
    expect([...groups.keys()]).toEqual(['2026-03-06', '2026-03-05']);
    expect(groups.get('2026-03-05')).toEqual([multi]);
    expect(groups.get('2026-03-06')).toEqual([multi, one]);
  });
});

describe('labels', () => {
  it('writes a short date with the lower-cased month', () => {
    expect(formatShortDate(at(2026, 2, 5), MONTHS)).toBe('5 mar');
    expect(formatShortDate(0, MONTHS)).toBe('');
  });

  it('writes the time of an event', () => {
    const start = at(2026, 2, 5, 9);
    expect(
      formatEventTime(
        event({ startAt: start, allDay: true }),
        'All day',
        MONTHS,
      ),
    ).toBe('All day');
    expect(formatEventTime(event({ startAt: start }), 'All day', MONTHS)).toBe(
      '09:00',
    );
    expect(
      formatEventTime(
        event({ startAt: start, endAt: at(2026, 2, 5, 10, 30) }),
        'All day',
        MONTHS,
      ),
    ).toBe('09:00 – 10:30');
    expect(
      formatEventTime(
        event({ startAt: start, endAt: at(2026, 2, 7, 11) }),
        'All day',
        MONTHS,
      ),
    ).toBe('09:00 – 7 mar 11:00');
  });
});

describe('form times', () => {
  it('builds an all-day event at local midnight without an end', () => {
    expect(eventTimesFromInputs('2026-03-05', true, '', '')).toEqual({
      startAt: at(2026, 2, 5),
      endAt: null,
    });
    expect(eventTimesFromInputs('', true, '', '')).toBeNull();
  });

  it('builds a timed event, with the end optional on the same date', () => {
    expect(eventTimesFromInputs('2026-03-05', false, '09:00', '')).toEqual({
      startAt: at(2026, 2, 5, 9),
      endAt: null,
    });
    expect(eventTimesFromInputs('2026-03-05', false, '09:00', '10:15')).toEqual(
      {
        startAt: at(2026, 2, 5, 9),
        endAt: at(2026, 2, 5, 10, 15),
      },
    );
    expect(eventTimesFromInputs('2026-03-05', false, '', '')).toBeNull();
  });

  it('accepts an end equal to the start but not before it', () => {
    expect(isEventEndValid({ startAt: 5, endAt: 5 })).toBe(true);
    expect(isEventEndValid({ startAt: 5, endAt: null })).toBe(true);
    expect(isEventEndValid({ startAt: 5, endAt: 4 })).toBe(false);
    expect(isEventEndValid(null)).toBe(true);
  });
});

describe('eventErrorKey', () => {
  it('maps the backend statuses to catalog keys', () => {
    expect(eventErrorKey(409)).toBe('eventStorageLimit');
    expect(eventErrorKey(413)).toBe('eventTooLarge');
    expect(eventErrorKey(400)).toBe('eventInvalid');
    expect(eventErrorKey(500)).toBe('eventSaveError');
    expect(eventErrorKey(undefined)).toBe('eventSaveError');
  });
});
