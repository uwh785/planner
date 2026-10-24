import { translate } from '@/application/i18n';
import { NotFoundError, ValidationError } from '@/domain';
import {
  openPlannerWorld,
  flushAsync,
  type PlannerWorld,
} from '../../helpers/plannerWorld';

let w: PlannerWorld;

const said = (): string | undefined => {
  const notice = w.planner.notices.getSnapshot();
  return notice
    ? translate('en', notice.message.key, notice.message.params)
    : undefined;
};
const start = new Date(2026, 9, 22, 9).getTime();

beforeEach(async () => {
  w = await openPlannerWorld();
});
afterEach(() => w.db.close());

describe('event use cases', () => {
  it('creates an event with a trimmed title and announces it', async () => {
    const created = await w.planner.events.create({
      title: '  Dentist ',
      startAt: start,
      location: ' Clinic ',
    });
    expect(created).toMatchObject({
      title: 'Dentist',
      location: 'Clinic',
      endAt: null,
    });
    expect(await w.events.list()).toHaveLength(1);
    expect(await w.outbox.pendingCount()).toBe(1);
    expect(said()).toBe('Added event Dentist');
  });

  it('refuses a blank title and an end before the start', async () => {
    await expect(
      w.planner.events.create({ title: '   ', startAt: start }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      w.planner.events.create({ title: 'x', startAt: start, endAt: start - 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await w.events.list()).toEqual([]);
  });

  it('updates an event and announces the save', async () => {
    const created = await w.planner.events.create({
      title: 'a',
      startAt: start,
    });
    const saved = await w.planner.events.update(created.id, {
      title: ' b ',
      allDay: true,
      endAt: null,
    });
    expect(saved).toMatchObject({ title: 'b', allDay: true });
    expect(said()).toBe('Saved event b');
  });

  it('rejects updating an event that does not exist', async () => {
    await expect(
      w.planner.events.update('evt_missing', { location: 'x' }),
    ).rejects.toMatchObject({ constructor: NotFoundError, entity: 'event' });
  });

  it('deletes an event, announcing it only when something was deleted', async () => {
    const created = await w.planner.events.create({
      title: 'a',
      startAt: start,
    });
    await w.planner.events.remove(created.id);
    expect(await w.events.list()).toEqual([]);
    expect(said()).toBe('Deleted event a');
    await w.planner.events.remove(created.id);
    expect(said()).toBe('Deleted event a');
  });
});

describe('event queries', () => {
  it('lists every event by start and follows changes', async () => {
    await w.events.create({ title: 'B', startAt: start + 1000 });
    await w.events.create({ title: 'A', startAt: start });
    const query = w.planner.queries.watchEvents();
    const seen: string[][] = [];
    const stop = query.subscribe(() => {
      const state = query.getSnapshot();
      if (state.status === 'ready') {
        seen.push(state.data.events.map(e => e.title));
      }
    });
    await flushAsync();
    await w.events.create({ title: 'C', startAt: start + 500 });
    await flushAsync();
    stop();
    expect(seen.at(-1)).toEqual(['A', 'C', 'B']);
  });

  it('reads one month: events overlapping it and tasks due in it', async () => {
    const day = (m: number, d: number, h = 0) =>
      new Date(2026, m, d, h).getTime();
    await w.events.create({ title: 'before', startAt: day(8, 30, 9) });
    await w.events.create({
      title: 'spills in',
      startAt: day(8, 30, 22),
      endAt: day(9, 1, 2),
    });
    await w.events.create({ title: 'inside', startAt: day(9, 15, 9) });
    await w.events.create({
      title: 'ends at midnight',
      startAt: day(8, 30, 20),
      endAt: day(9, 1),
    });
    await w.events.create({ title: 'after', startAt: day(10, 1, 0) });
    await w.tasks.create({ title: 'due in', dueDate: day(9, 31, 23) });
    await w.tasks.create({ title: 'due out', dueDate: day(10, 1) });
    const data = await w.planner.queries.calendarMonth(2026, 9);
    expect(data.events.map(e => e.title)).toEqual(['spills in', 'inside']);
    expect(data.tasks.map(t => t.title)).toEqual(['due in']);
    const live = w.planner.queries.watchCalendarMonth(2026, 9);
    const stop = live.subscribe(() => undefined);
    await flushAsync();
    expect(live.getSnapshot()).toMatchObject({ status: 'ready' });
    stop();
  });
});
