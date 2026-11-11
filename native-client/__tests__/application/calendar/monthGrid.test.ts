import {
  buildMonthGrid,
  monthBounds,
  shiftMonth,
} from '@/application/calendar/monthGrid';
import type { Event, Task } from '@/domain';

const at = (y: number, m: number, d: number, h = 0) =>
  new Date(y, m, d, h).getTime();

const ev = (
  id: string,
  startAt: number,
  endAt: number | null = null,
): Event => ({
  id,
  title: id,
  description: '',
  location: '',
  startAt,
  endAt,
  allDay: false,
  remind: false,
  color: '',
  updatedAt: 1,
  deleted: false,
});
const task = (id: string, dueDate: number): Task =>
  ({ id, dueDate } as unknown as Task);

describe('monthBounds and shiftMonth', () => {
  it('covers the month half-open', () => {
    expect(monthBounds(2026, 9)).toEqual({
      from: at(2026, 9, 1),
      to: at(2026, 10, 1),
    });
    expect(monthBounds(2026, 11).to).toBe(at(2027, 0, 1));
  });

  it('moves across years', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
  });
});

describe('buildMonthGrid', () => {
  it('pads to Sunday-first weeks of seven', () => {
    // 1 Oct 2026 is a Thursday and the 31st a Saturday: four blanks, no tail.
    const weeks = buildMonthGrid(2026, 9, [], []);
    expect(weeks.every(week => week.length === 7)).toBe(true);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]!.slice(0, 4)).toEqual([null, null, null, null]);
    expect(weeks[0]![4]).toMatchObject({ day: 1, dayStart: at(2026, 9, 1) });
    expect(weeks[4]!.at(-1)).toMatchObject({ day: 31 });
    // November starts on a Sunday and ends on a Monday: a tail of blanks.
    const nov = buildMonthGrid(2026, 10, [], []);
    expect(nov[0]![0]).toMatchObject({ day: 1 });
    expect(nov.at(-1)!.slice(2)).toEqual([null, null, null, null, null]);
    expect(weeks.flat().filter(c => c !== null)).toHaveLength(31);
  });

  it('puts events under every day they span and tasks under their due day', () => {
    const multi = ev('multi', at(2026, 9, 5, 20), at(2026, 9, 6, 3));
    const single = ev('single', at(2026, 9, 6, 9));
    const t1 = task('t1', at(2026, 9, 6, 23));
    const t2 = task('t2', at(2026, 9, 7));
    const cells = buildMonthGrid(2026, 9, [single, multi], [t1, t2])
      .flat()
      .filter((c): c is NonNullable<typeof c> => c !== null);
    const day = (n: number) => cells.find(c => c.day === n)!;
    expect(day(5).events).toEqual([multi]);
    expect(day(6).events).toEqual([multi, single]);
    expect(day(6).tasks).toEqual([t1]);
    expect(day(7).tasks).toEqual([t2]);
    expect(day(8).events).toEqual([]);
  });

  it('ignores events and tasks of other months', () => {
    const cells = buildMonthGrid(
      2026,
      9,
      [ev('nov', at(2026, 10, 2, 9))],
      [task('sep', at(2026, 8, 30))],
    )
      .flat()
      .filter(c => c !== null);
    expect(
      cells.every(c => c!.events.length === 0 && c!.tasks.length === 0),
    ).toBe(true);
  });
});
