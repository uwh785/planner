import {
  completeTimer,
  InvalidTransitionError,
  pauseTimer,
  startTimer,
  ValidationError,
  type TimerState,
} from '@/domain';

const state = (patch: Partial<TimerState> = {}): TimerState => ({
  status: 'pending',
  startedAt: null,
  elapsedMs: 0,
  completedAt: null,
  ...patch,
});

describe('start (backend StartTask)', () => {
  it('takes a pending task to in progress, started at the given moment', () => {
    expect(startTimer(state(), 5_000)).toEqual(
      state({ status: 'in_progress', startedAt: 5_000 }),
    );
  });

  it('keeps what a paused task already accumulated, so the countdown resumes', () => {
    expect(startTimer(state({ elapsedMs: 90_000 }), 7_000)).toMatchObject({
      status: 'in_progress',
      startedAt: 7_000,
      elapsedMs: 90_000,
    });
  });

  it.each(['in_progress', 'completed'] as const)(
    'refuses a task that is %s',
    from => {
      expect(() => startTimer(state({ status: from }), 1)).toThrow(
        new InvalidTransitionError('start', from),
      );
    },
  );
});

describe('pause (backend PauseTask)', () => {
  it('goes back to pending, adds the segment just run and clears the start', () => {
    const running = state({
      status: 'in_progress',
      startedAt: 10_000,
      elapsedMs: 2_000,
    });
    expect(pauseTimer(running, 16_500)).toEqual(
      state({ status: 'pending', startedAt: null, elapsedMs: 8_500 }),
    );
  });

  it('never adds a negative segment when the clock is behind the start', () => {
    const running = state({ status: 'in_progress', startedAt: 10_000 });
    expect(pauseTimer(running, 4_000).elapsedMs).toBe(0);
  });

  it('adds nothing for a legacy in-progress row without a start', () => {
    const odd = state({ status: 'in_progress', elapsedMs: 700 });
    expect(pauseTimer(odd, 99_000)).toMatchObject({
      status: 'pending',
      elapsedMs: 700,
    });
  });

  it.each(['pending', 'completed'] as const)(
    'refuses a task that is %s',
    from => {
      expect(() => pauseTimer(state({ status: from }), 1)).toThrow(
        new InvalidTransitionError('pause', from),
      );
    },
  );
});

describe('complete (backend CompleteTask)', () => {
  it('completes a pending task and leaves its accumulated time alone', () => {
    expect(completeTimer(state({ elapsedMs: 4_000 }), 9_000)).toEqual(
      state({ status: 'completed', completedAt: 9_000, elapsedMs: 4_000 }),
    );
  });

  it('folds the running segment into elapsed time, as a pause does', () => {
    const running = state({
      status: 'in_progress',
      startedAt: 1_000,
      elapsedMs: 100,
    });
    expect(completeTimer(running, 4_000)).toEqual(
      state({
        status: 'completed',
        completedAt: 4_000,
        startedAt: null,
        elapsedMs: 3_100,
      }),
    );
  });

  it('refuses a task that is already completed', () => {
    expect(() =>
      completeTimer(state({ status: 'completed', completedAt: 1 }), 5),
    ).toThrow(new InvalidTransitionError('complete', 'completed'));
  });
});

describe('the moment of a transition', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'must be a positive integer of milliseconds, not %p',
    at => {
      expect(() => startTimer(state(), at)).toThrow(ValidationError);
      expect(() => pauseTimer(state({ status: 'in_progress' }), at)).toThrow(
        ValidationError,
      );
      expect(() => completeTimer(state(), at)).toThrow(ValidationError);
    },
  );

  it('is checked before the status, so a bad moment never hides behind a bad state', () => {
    expect(() => startTimer(state({ status: 'completed' }), 0)).toThrow(
      ValidationError,
    );
  });
});

it('a start, pause, start, complete sequence adds up every running segment', () => {
  let t = startTimer(state(), 1_000);
  t = pauseTimer(t, 4_000); // 3 s
  t = startTimer(t, 10_000);
  t = completeTimer(t, 12_500); // 2.5 s
  expect(t).toMatchObject({
    status: 'completed',
    elapsedMs: 5_500,
    completedAt: 12_500,
    startedAt: null,
  });
});
