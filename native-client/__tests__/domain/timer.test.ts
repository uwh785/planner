import { elapsedMs, remainingMs, timerProgress } from '@/domain';

const HOUR = 3_600_000;
const task = (patch: Record<string, unknown>) => ({
  status: 'pending' as const,
  durationMs: 2 * HOUR,
  startedAt: null as number | null,
  elapsedMs: 0,
  ...patch,
});

describe('task timer (the web CountdownRing rules)', () => {
  it('a running task adds the current segment to what was accumulated', () => {
    const running = task({
      status: 'in_progress',
      startedAt: 1_000,
      elapsedMs: HOUR / 2,
    });
    expect(elapsedMs(running, 1_000 + HOUR / 2)).toBe(HOUR);
    expect(timerProgress(running, 1_000 + HOUR / 2)).toBe(0.5);
    expect(remainingMs(running, 1_000 + HOUR / 2)).toBe(HOUR);
  });

  it('never counts a negative segment when the clock is behind the start', () => {
    const running = task({ status: 'in_progress', startedAt: 5_000 });
    expect(elapsedMs(running, 1_000)).toBe(0);
  });

  it('a paused task (no start) is frozen at its accumulated time', () => {
    const paused = task({ status: 'in_progress', elapsedMs: HOUR });
    expect(elapsedMs(paused, 99 * HOUR)).toBe(HOUR);
    expect(remainingMs(paused, 99 * HOUR)).toBe(HOUR);
  });

  it('a task that never started has its whole duration left', () => {
    expect(timerProgress(task({}), 5)).toBe(0);
    expect(remainingMs(task({}), 5)).toBe(2 * HOUR);
  });

  it('progress stops at 1 and remaining at 0 once the time is used up', () => {
    const over = task({ status: 'in_progress', startedAt: 0 });
    expect(timerProgress(over, 5 * HOUR)).toBe(1);
    expect(remainingMs(over, 5 * HOUR)).toBe(0);
  });

  it('a completed task is full and has nothing left, whatever it recorded', () => {
    const done = task({ status: 'completed' });
    expect(timerProgress(done, 1)).toBe(1);
    expect(remainingMs(done, 1)).toBe(0);
  });

  it('a task without a duration has no progress and no time left', () => {
    const open = task({ durationMs: null });
    expect(timerProgress(open, 1)).toBe(0);
    expect(remainingMs(open, 1)).toBe(0);
  });
});
