import {
  addDays,
  combineLocalDateTime,
  fromDateInputValue,
  isSameLocalDay,
  startOfLocalDay,
  toDateInputValue,
  toTimeInputValue,
} from '@/application/calendar/localDate';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m, d, h, min).getTime();

describe('local date helpers', () => {
  it('finds local midnight and adds calendar days keeping the wall clock', () => {
    expect(startOfLocalDay(at(2026, 9, 22, 15, 30))).toBe(at(2026, 9, 22));
    expect(addDays(at(2026, 9, 31, 9, 15), 1)).toBe(at(2026, 10, 1, 9, 15));
    expect(addDays(at(2026, 0, 1), -1)).toBe(at(2025, 11, 31));
  });

  it('compares local days', () => {
    expect(isSameLocalDay(at(2026, 2, 5, 1), at(2026, 2, 5, 23))).toBe(true);
    expect(isSameLocalDay(at(2026, 2, 5, 23), at(2026, 2, 6, 0))).toBe(false);
    expect(isSameLocalDay(0, at(2026, 2, 5))).toBe(false);
  });

  it('writes and reads date and time input values', () => {
    expect(toDateInputValue(at(2026, 2, 5, 18))).toBe('2026-03-05');
    expect(toTimeInputValue(at(2026, 2, 5, 9, 5))).toBe('09:05');
    expect(fromDateInputValue('2026-03-05')).toBe(at(2026, 2, 5));
    expect(fromDateInputValue('')).toBeNull();
    expect(fromDateInputValue('nope')).toBeNull();
    expect(combineLocalDateTime('2026-03-05', '14:30')).toBe(
      at(2026, 2, 5, 14, 30),
    );
    expect(combineLocalDateTime('', '14:30')).toBeNull();
  });
});
