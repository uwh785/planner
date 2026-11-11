import {
  dateInDays,
  daysUntil,
  upcomingReminders,
} from '@/application/calendar/reminders';
import type { Event } from '@/domain';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m, d, h, min).getTime();

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
    remind: true,
    color: '',
    updatedAt: 1,
    deleted: false,
    ...patch,
  };
}

describe('daysUntil', () => {
  it('counts whole local days, whatever the time of day', () => {
    const now = at(2026, 10, 11, 23, 59);
    expect(daysUntil(at(2026, 10, 11, 0, 1), now)).toBe(0);
    expect(daysUntil(at(2026, 10, 12, 0, 1), now)).toBe(1);
    expect(daysUntil(at(2026, 11, 10, 8), now)).toBe(29);
  });

  it('is negative for a past day', () => {
    expect(daysUntil(at(2026, 10, 10, 23), at(2026, 10, 11, 1))).toBe(-1);
  });

  it('is not shifted by the 23 and 25 hour days of a DST change', () => {
    // Both ranges cross a clock change wherever the zone has one.
    expect(daysUntil(at(2027, 0, 10), at(2026, 10, 11, 15))).toBe(60);
    expect(daysUntil(at(2026, 3, 30), at(2026, 1, 1, 15))).toBe(88);
    expect(daysUntil(at(2026, 10, 30), at(2026, 8, 1, 15))).toBe(90);
  });
});

describe('upcomingReminders', () => {
  const now = at(2026, 10, 11, 15);

  it('keeps flagged events from today on, soonest first, with the days left', () => {
    const far = event({ startAt: at(2027, 0, 10, 9) });
    const today = event({ startAt: at(2026, 10, 11, 8) });
    const tomorrow = event({ startAt: at(2026, 10, 12, 9) });
    expect(upcomingReminders([far, today, tomorrow], now)).toEqual([
      { event: today, daysLeft: 0 },
      { event: tomorrow, daysLeft: 1 },
      { event: far, daysLeft: 60 },
    ]);
  });

  it('drops past reminders and events that are not flagged', () => {
    const yesterday = event({ startAt: at(2026, 10, 10, 23) });
    const plain = event({ startAt: at(2026, 10, 20), remind: false });
    expect(upcomingReminders([yesterday, plain], now)).toEqual([]);
  });

  it('keeps the given order for events starting at the same moment', () => {
    const a = event({ startAt: at(2026, 10, 20, 9) });
    const b = event({ startAt: at(2026, 10, 20, 9) });
    const earlier = event({ startAt: at(2026, 10, 20, 8) });
    expect(upcomingReminders([a, b, earlier], now).map(r => r.event)).toEqual([
      earlier,
      a,
      b,
    ]);
  });
});

describe('dateInDays', () => {
  it('is the local date value of today plus n days', () => {
    const now = at(2026, 10, 11, 15);
    expect(dateInDays(now, 0)).toBe('2026-11-11');
    expect(dateInDays(now, 30)).toBe('2026-12-11');
    expect(dateInDays(now, 60)).toBe('2027-01-10');
    expect(dateInDays(now, 90)).toBe('2027-02-09');
  });

  it('agrees with daysUntil late in the day', () => {
    const now = at(2026, 2, 1, 23, 30);
    const [y, m, d] = dateInDays(now, 60).split('-').map(Number);
    expect(daysUntil(at(y!, m! - 1, d!), now)).toBe(60);
  });
});
