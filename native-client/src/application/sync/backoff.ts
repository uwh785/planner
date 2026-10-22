/** Wait before retry number 1, 2, 3, ... after consecutive failures. */
export const BACKOFF_SCHEDULE_MS: readonly number[] = [
  2_000, 5_000, 15_000, 60_000, 300_000, 900_000,
];

/** The longest wait, however many failures in a row. */
export const BACKOFF_CAP_MS = 900_000;

/** Each step is spread by up to this share either way, so clients do not herd. */
const JITTER = 0.2;

/**
 * Delay before the next attempt after `failures` consecutive failures (1 is
 * the first). Pure: `random` returns a number in [0, 1) and is injected.
 * Schedule 2 s, 5 s, 15 s, 60 s, 5 min, 15 min, then the cap; each step
 * jittered by plus or minus 20% and never above the cap.
 */
export function backoffDelayMs(failures: number, random: () => number): number {
  const step = Math.min(
    Math.max(Math.floor(failures), 1),
    BACKOFF_SCHEDULE_MS.length,
  );
  const base = BACKOFF_SCHEDULE_MS[step - 1] ?? BACKOFF_CAP_MS;
  const spread = 1 - JITTER + 2 * JITTER * random();
  return Math.min(Math.round(base * spread), BACKOFF_CAP_MS);
}
