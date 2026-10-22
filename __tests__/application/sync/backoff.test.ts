import {
  BACKOFF_CAP_MS,
  BACKOFF_SCHEDULE_MS,
  backoffDelayMs,
} from '@/application/sync/backoff';

describe('backoffDelayMs', () => {
  it('follows 2 s, 5 s, 15 s, 60 s, 5 min, then caps at 15 min (middle jitter)', () => {
    const delays = [1, 2, 3, 4, 5, 6, 7, 50].map(n =>
      backoffDelayMs(n, () => 0.5),
    );
    expect(delays).toEqual([
      2000, 5000, 15000, 60000, 300000, 900000, 900000, 900000,
    ]);
    expect(BACKOFF_CAP_MS).toBe(900000);
    expect(BACKOFF_SCHEDULE_MS).toHaveLength(6);
  });

  it('spreads each step by up to 20% either way and never exceeds the cap', () => {
    expect(backoffDelayMs(1, () => 0)).toBe(1600);
    expect(backoffDelayMs(1, () => 0.999999)).toBeLessThanOrEqual(2400);
    expect(backoffDelayMs(4, () => 0)).toBe(48000);
    expect(backoffDelayMs(6, () => 1)).toBe(BACKOFF_CAP_MS);
    expect(backoffDelayMs(99, () => 0.9)).toBeLessThanOrEqual(BACKOFF_CAP_MS);
  });

  it('treats zero or negative failure counts as the first step', () => {
    expect(backoffDelayMs(0, () => 0.5)).toBe(2000);
    expect(backoffDelayMs(-3, () => 0.5)).toBe(2000);
  });

  it('is pure: same inputs, same output', () => {
    expect(backoffDelayMs(3, () => 0.3)).toBe(backoffDelayMs(3, () => 0.3));
  });
});
