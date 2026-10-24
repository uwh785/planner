export interface TimedClass {
  startMinute: number;
  endMinute: number;
}

export interface TodaySplit<C extends TimedClass> {
  /** In progress: it started and has not ended. */
  current: C | null;
  /** The first one still to start. */
  next: C | null;
  /** The ones after `next`. */
  upcoming: C[];
}

/**
 * Today's classes against the minute of the day, as the web's Panel splits
 * them. A class is in progress from its start up to, not including, its end.
 */
export function splitTodayClasses<C extends TimedClass>(
  classes: readonly C[],
  nowMinute: number,
): TodaySplit<C> {
  let current: C | null = null;
  const future: C[] = [];
  for (const c of classes) {
    if (c.startMinute <= nowMinute && nowMinute < c.endMinute) {
      current ??= c;
    } else if (c.startMinute > nowMinute) {
      future.push(c);
    }
  }
  future.sort((a, b) => a.startMinute - b.startMinute);
  return { current, next: future[0] ?? null, upcoming: future.slice(1) };
}
