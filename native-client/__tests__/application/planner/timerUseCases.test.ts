import { translate } from '@/application/i18n';
import { TIMER_DEBOUNCE_MS } from '@/application/planner/TaskTimerUseCases';
import {
  flushAsync,
  openPlannerWorld,
  type PlannerWorld,
} from '../../helpers/plannerWorld';
import { outboxRows } from '../../helpers/testRepositories';

let w: PlannerWorld;
beforeEach(async () => {
  w = await openPlannerWorld();
});
afterEach(() => w.db.close());

const timer = () => w.planner.taskTimer;
const said = (): string | undefined => {
  const notice = w.planner.notices.getSnapshot();
  return notice
    ? translate('en', notice.message.key, notice.message.params)
    : undefined;
};
const known = async (patch: Record<string, unknown> = {}) => {
  const task = await w.tasks.create({ title: 'Write', ...patch });
  await w.outbox.markSent((await w.outbox.peekPending(9)).map(e => e.id));
  return task;
};

describe('start and pause from the screen', () => {
  it('start stamps the moment of the tap, not the moment the write finished', async () => {
    const task = await known();
    const tapped = w.clock.now();
    const writing = timer().start(task.id);
    w.clock.tick(7_000);
    expect(await writing).toBe('done');
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'in_progress',
      startedAt: tapped,
    });
    const [entry] = await outboxRows(w.db);
    expect(JSON.parse(entry!.payload)).toEqual({ at: tapped });
  });

  it('pause adds exactly the time between the two taps', async () => {
    const task = await known();
    await timer().start(task.id);
    w.clock.tick(90_000);
    expect(await timer().pause(task.id)).toBe('done');
    expect(await w.tasks.get(task.id)).toMatchObject({
      status: 'pending',
      elapsedMs: 90_000,
      startedAt: null,
    });
  });

  it('says what happened, by title, for the live region', async () => {
    const task = await known();
    await timer().start(task.id);
    expect(said()).toBe('Started Write');
    w.clock.tick(TIMER_DEBOUNCE_MS + 1);
    await timer().pause(task.id);
    expect(said()).toBe('Paused Write');
  });
});

describe('double taps', () => {
  it('a second start while the first is still writing is ignored: one entry', async () => {
    const task = await known();
    const [first, second] = await Promise.all([
      timer().start(task.id),
      timer().start(task.id),
    ]);
    expect([first, second]).toEqual(['done', 'ignored']);
    expect(await outboxRows(w.db)).toHaveLength(1);
  });

  it('a tap right after a committed one is ignored for a short moment, then works again', async () => {
    const task = await known();
    expect(await timer().start(task.id)).toBe('done');
    w.clock.tick(TIMER_DEBOUNCE_MS - 1);
    expect(await timer().pause(task.id)).toBe('ignored');
    expect((await w.tasks.get(task.id))?.status).toBe('in_progress');
    w.clock.tick(2);
    expect(await timer().pause(task.id)).toBe('done');
    expect((await w.tasks.get(task.id))?.status).toBe('pending');
    expect((await outboxRows(w.db)).map(r => r.op)).toEqual(['start', 'pause']);
  });

  it("other tasks are not held back by one task's taps", async () => {
    const a = await known();
    const b = await w.tasks.create({ title: 'B' });
    expect(await timer().start(a.id)).toBe('done');
    expect(await timer().start(b.id)).toBe('done');
  });

  it('an ignored tap says nothing and writes nothing', async () => {
    const task = await known();
    await timer().start(task.id);
    w.planner.notices.dispose();
    const before = await outboxRows(w.db);
    await timer().start(task.id);
    expect(await outboxRows(w.db)).toEqual(before);
  });
});

describe('what cannot be done', () => {
  it('a transition the status no longer allows is refused and changes nothing', async () => {
    const task = await known();
    expect(await timer().pause(task.id)).toBe('refused');
    expect(await outboxRows(w.db)).toEqual([]);
  });

  it('a task that is gone is reported, not thrown', async () => {
    expect(await timer().start('tsk_missing')).toBe('gone');
  });

  it('an unexpected write failure is told politely and can be retried', async () => {
    const task = await known();
    jest.spyOn(w.tasks, 'start').mockRejectedValueOnce(new Error('disk'));
    expect(await timer().start(task.id)).toBe('failed');
    expect(said()).toBe("Couldn't update Write. Try again.");
    await flushAsync();
    w.clock.tick(TIMER_DEBOUNCE_MS + 1);
    expect(await timer().start(task.id)).toBe('done');
  });

  it('a failed write does not start the debounce (the user can try again at once)', async () => {
    const task = await known();
    jest.spyOn(w.tasks, 'start').mockRejectedValueOnce(new Error('disk'));
    await timer().start(task.id);
    expect(await timer().start(task.id)).toBe('done');
  });
});
