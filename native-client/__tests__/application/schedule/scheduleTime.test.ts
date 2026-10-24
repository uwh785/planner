import {
  dowToMondayIndex,
  formatTimeRange,
  minuteOfDay,
  minuteToTime,
  mondayIndexToDow,
  timeToMinute,
  weekdayOf,
} from '@/application/schedule/scheduleTime';

describe('time and weekday helpers', () => {
  it('writes minutes as HH:MM and reads them back', () => {
    expect(minuteToTime(0)).toBe('00:00');
    expect(minuteToTime(485)).toBe('08:05');
    expect(minuteToTime(1440)).toBe('24:00');
    expect(timeToMinute('08:05')).toBe(485);
    expect(timeToMinute('23:59')).toBe(1439);
    expect(timeToMinute('')).toBe(0);
  });

  it('formats a range with an en dash', () => {
    expect(formatTimeRange(480, 540)).toBe('08:00 – 09:00');
  });

  it('maps Monday-first tab indexes to weekdays and back', () => {
    expect(dowToMondayIndex(1)).toBe(0);
    expect(dowToMondayIndex(0)).toBe(6);
    expect(mondayIndexToDow(0)).toBe(1);
    expect(mondayIndexToDow(6)).toBe(0);
    for (let dow = 0; dow < 7; dow += 1) {
      expect(mondayIndexToDow(dowToMondayIndex(dow))).toBe(dow);
    }
  });

  it('reads the local weekday and minute of the day', () => {
    const thursday = new Date(2026, 9, 22, 10, 7).getTime();
    expect(weekdayOf(thursday)).toBe(4);
    expect(minuteOfDay(thursday)).toBe(607);
  });
});
