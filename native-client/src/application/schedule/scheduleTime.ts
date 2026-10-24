/** Minutes count from local midnight; weekdays are 0 (Sunday) to 6. */

const pad = (n: number): string => String(n).padStart(2, '0');

/** 485 -> "08:05". */
export function minuteToTime(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/** "08:05" -> 485; anything unreadable counts as midnight. */
export function timeToMinute(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** "08:00 – 09:00" (en dash), as the web's class card writes it. */
export function formatTimeRange(
  startMinute: number,
  endMinute: number,
): string {
  return `${minuteToTime(startMinute)} – ${minuteToTime(endMinute)}`;
}

/** The schedule's tabs run Monday first: Sunday (0) is the last. */
export const dowToMondayIndex = (dow: number): number => (dow + 6) % 7;
export const mondayIndexToDow = (index: number): number => (index + 1) % 7;

/** The local weekday (0 = Sunday) of an epoch-millisecond instant. */
export const weekdayOf = (ms: number): number => new Date(ms).getDay();

/** Minutes since local midnight of an epoch-millisecond instant. */
export function minuteOfDay(ms: number): number {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}
