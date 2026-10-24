/**
 * Local-calendar helpers (the web's utils.js). Everything works in the
 * device's time zone; timestamps are epoch milliseconds.
 */

/** Local midnight of the day holding `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Adds `n` calendar days, keeping the wall-clock time (safe across DST). */
export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  ).getTime();
}

export function isSameLocalDay(a: number, b: number): boolean {
  if (!a || !b) {
    return false;
  }
  return startOfLocalDay(a) === startOfLocalDay(b);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "2026-03-05" in local time. */
export function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-03-05" to local midnight; null when it is not a date. */
export function fromDateInputValue(text: string): number | null {
  const [y, m, d] = text.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }
  return new Date(y, m - 1, d).getTime();
}

/** "09:05" in local time. */
export function toTimeInputValue(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A local "YYYY-MM-DD" and "HH:MM" to epoch milliseconds. */
export function combineLocalDateTime(
  dateText: string,
  timeText: string,
): number | null {
  const [y, m, d] = dateText.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }
  const [h, mi] = (timeText || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, h || 0, mi || 0, 0, 0).getTime();
}
