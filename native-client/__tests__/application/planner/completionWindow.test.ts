import {
  COMPLETION_WINDOW_MS,
  CompletionWindow,
} from '@/application/planner/CompletionWindow';
import {
  flushAsync,
  openPlannerWorld,
  type PlannerWorld,
} from '../../helpers/plannerWorld';

let w: PlannerWorld;
beforeEach(async () => {
  w = await openPlannerWorld();
});
afterEach(() => w.db.close());

const status = async (id: string) => (await w.tasks.get(id))?.status;
const completion = () => w.planner.completion;

describe('the undo window', () => {
  it('is about five seconds', () => {
    expect(COMPLETION_WINDOW_MS).toBe(5_000);
  });

  it('shows the task as completing but writes nothing yet', async () => {
    const t = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
    completion().begin(t);
    expect(completion().has(t.id)).toBe(true);
    expect([...completion().getSnapshot()]).toEqual([t.id]);
    w.timer.advance(4_900);
    await flushAsync();
    expect(await status(t.id)).toBe('pending');
    expect(await w.outbox.pendingCount()).toBe(0);
  });

  it('completes and queues the push when the window elapses, stamped with the tap time', async () => {
    const t = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
    const tapped = w.clock.now();
    completion().begin(t);
    w.timer.advance(COMPLETION_WINDOW_MS);
    await flushAsync();
    expect(await w.tasks.get(t.id)).toMatchObject({
      status: 'completed',
      completedAt: tapped,
    });
    const [entry] = await w.outbox.peekPending(9);
    expect(entry).toMatchObject({ op: 'complete', payload: { at: tapped } });
    expect(completion().has(t.id)).toBe(false);
  });

  it('undo cancels it: nothing is written, no entry is queued', async () => {
    const t = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
    completion().begin(t);
    w.timer.advance(2_000);
    completion().undo(t.id);
    expect(completion().has(t.id)).toBe(false);
    w.timer.advance(10_000);
    await flushAsync();
    expect(await status(t.id)).toBe('pending');
    expect(await w.outbox.pendingCount()).toBe(0);
  });

  it('beginning twice does not restart or duplicate the window', async () => {
    const t = await w.tasks.create({ title: 'a' });
    completion().begin(t);
    w.timer.advance(3_000);
    completion().begin(t);
    w.timer.advance(2_000);
    await flushAsync();
    expect(await status(t.id)).toBe('completed');
    expect(await w.outbox.pendingCount()).toBe(2);
  });

  it('keeps a window per task', async () => {
    const a = await w.tasks.create({ title: 'a' });
    w.clock.tick(1_000);
    const b = await w.tasks.create({ title: 'b' });
    completion().begin(a);
    w.timer.advance(2_000);
    completion().begin(b);
    w.timer.advance(3_000);
    await flushAsync();
    expect(await status(a.id)).toBe('completed');
    expect(await status(b.id)).toBe('pending');
    w.timer.advance(2_000);
    await flushAsync();
    expect(await status(b.id)).toBe('completed');
  });

  it('announces both steps', async () => {
    const t = await w.tasks.create({ title: 'Call Ann' });
    completion().begin(t);
    expect(w.planner.notices.getSnapshot()?.text).toBe(
      'Completed Call Ann. Undo is available.',
    );
    completion().undo(t.id);
    expect(w.planner.notices.getSnapshot()?.text).toBe('Call Ann is open again');
  });

  it('notifies subscribers with a new snapshot object on every change', () => {
    const seen = jest.fn();
    completion().subscribe(seen);
    const before = completion().getSnapshot();
    completion().begin({ id: 'tsk_1', title: 'x' });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(completion().getSnapshot()).not.toBe(before);
    expect(completion().getSnapshot()).toBe(completion().getSnapshot());
    completion().undo('tsk_1');
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('a task deleted inside the window is simply skipped', async () => {
    const t = await w.tasks.create({ title: 'a' });
    completion().begin(t);
    await w.tasks.delete(t.id);
    w.timer.advance(COMPLETION_WINDOW_MS);
    await flushAsync();
    expect(completion().has(t.id)).toBe(false);
    expect(await w.tasks.get(t.id)).toBeNull();
  });

  it('a failed write puts the task back as open and says so', async () => {
    const t = await w.tasks.create({ title: 'a' });
    completion().begin(t);
    await w.db.execute('DROP TABLE outbox');
    w.timer.advance(COMPLETION_WINDOW_MS);
    await flushAsync();
    expect(completion().has(t.id)).toBe(false);
    expect(await status(t.id)).toBe('pending');
    expect(w.planner.notices.getSnapshot()?.text).toBe(
      "Couldn't complete a. Try again.",
    );
  });
});

describe('flushing the window', () => {
  it('flush() completes every pending task at once and cancels the timers', async () => {
    const a = await w.tasks.create({ title: 'a' });
    w.clock.tick(10);
    const b = await w.tasks.create({ title: 'b' });
    completion().begin(a);
    completion().begin(b);
    await completion().flush();
    expect(await status(a.id)).toBe('completed');
    expect(await status(b.id)).toBe('completed');
    expect(completion().getSnapshot().size).toBe(0);
    // The window timers are gone: letting time pass writes nothing more.
    const queued = await w.outbox.pendingCount();
    w.timer.advance(10_000);
    await flushAsync();
    expect(await w.outbox.pendingCount()).toBe(queued);
  });

  it('uses the tap time even when flushed later', async () => {
    const t = await w.tasks.create({ title: 'a' });
    const tapped = w.clock.now();
    completion().begin(t);
    w.clock.tick(3_000);
    await completion().flush();
    expect((await w.tasks.get(t.id))?.completedAt).toBe(tapped);
  });

  it('flush() with nothing pending is a no-op', async () => {
    await expect(completion().flush()).resolves.toBeUndefined();
  });

  it('flushes when the app goes to the background', async () => {
    const t = await w.tasks.create({ title: 'a' });
    completion().begin(t);
    w.lifecycle.set(false);
    await flushAsync();
    expect(await status(t.id)).toBe('completed');
  });

  it('does nothing when the app comes back to the foreground', async () => {
    const t = await w.tasks.create({ title: 'a' });
    completion().begin(t);
    w.lifecycle.set(true);
    await flushAsync();
    expect(await status(t.id)).toBe('pending');
    expect(completion().has(t.id)).toBe(true);
  });

  it('dispose() stops listening to the app and drops timers without writing', async () => {
    const t = await w.tasks.create({ title: 'a' });
    completion().begin(t);
    w.planner.dispose();
    expect(w.lifecycle.listeners).toBe(0);
    expect(w.timer.size).toBe(0);
    w.timer.advance(10_000);
    await flushAsync();
    expect(await status(t.id)).toBe('pending');
  });

  it('a flush racing the elapsing timer completes once', async () => {
    const t = await w.tasks.create({ title: 'a' });
    await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
    completion().begin(t);
    const flushing = completion().flush();
    w.timer.advance(COMPLETION_WINDOW_MS);
    await flushing;
    await flushAsync();
    expect(await w.outbox.pendingCount()).toBe(1);
  });
});

describe('settling', () => {
  it('keeps the task completing until the screens have refreshed', async () => {
    const t = await w.tasks.create({ title: 'a' });
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const window = new CompletionWindow({
      tasks: w.tasks,
      timer: w.timer,
      clock: w.clock,
      settled: () => gate,
    });
    window.begin(t);
    w.timer.advance(COMPLETION_WINDOW_MS);
    await flushAsync();
    expect(await status(t.id)).toBe('completed');
    expect(window.has(t.id)).toBe(true);
    release();
    await flushAsync();
    expect(window.has(t.id)).toBe(false);
  });
});
