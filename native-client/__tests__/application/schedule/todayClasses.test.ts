import { splitTodayClasses } from '@/application/schedule/todayClasses';

const at = (id: string, startMinute: number, endMinute: number) => ({
  id,
  startMinute,
  endMinute,
});

describe('splitTodayClasses', () => {
  const day = [
    at('a', 480, 540),
    at('b', 600, 660),
    at('c', 720, 780),
    at('d', 900, 960),
  ];

  it('finds the class in progress, the next and the rest', () => {
    const split = splitTodayClasses(day, 610);
    expect(split.current?.id).toBe('b');
    expect(split.next?.id).toBe('c');
    expect(split.upcoming.map(c => c.id)).toEqual(['d']);
  });

  it('treats start as inside and end as outside', () => {
    expect(splitTodayClasses(day, 600).current?.id).toBe('b');
    expect(splitTodayClasses(day, 660).current).toBeNull();
    expect(splitTodayClasses(day, 660).next?.id).toBe('c');
  });

  it('has no current between classes and nothing after the last', () => {
    expect(splitTodayClasses(day, 700).current).toBeNull();
    expect(splitTodayClasses(day, 1000)).toEqual({
      current: null,
      next: null,
      upcoming: [],
    });
  });

  it('sorts the future by start time', () => {
    const split = splitTodayClasses([at('z', 900, 960), at('y', 700, 760)], 0);
    expect(split.next?.id).toBe('y');
    expect(split.upcoming.map(c => c.id)).toEqual(['z']);
  });
});
