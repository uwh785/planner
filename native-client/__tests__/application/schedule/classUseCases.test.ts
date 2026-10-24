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
const input = {
  subject: '  Física ',
  dayOfWeek: 1,
  startMinute: 480,
  endMinute: 540,
};

beforeEach(async () => {
  w = await openPlannerWorld();
});
afterEach(() => w.db.close());

describe('class use cases', () => {
  it('creates a class with the subject trimmed and upper-cased, and announces it', async () => {
    const created = await w.planner.classes.create({
      ...input,
      room: ' A1 ',
      teacher: 'Ruiz',
    });
    expect(created).toMatchObject({
      subject: 'FÍSICA',
      room: 'A1',
      teacher: 'Ruiz',
      dayOfWeek: 1,
    });
    expect(await w.classSessions.list()).toHaveLength(1);
    expect(await w.outbox.pendingCount()).toBe(1);
    expect(said()).toBe('Added class FÍSICA');
  });

  it('refuses a blank subject and an end that is not after the start', async () => {
    await expect(
      w.planner.classes.create({ ...input, subject: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      w.planner.classes.create({ ...input, endMinute: 480 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await w.classSessions.list()).toEqual([]);
  });

  it('updates a class and announces the save', async () => {
    const created = await w.planner.classes.create(input);
    const saved = await w.planner.classes.update(created.id, {
      subject: ' Química ',
      endMinute: 600,
      color: '#FF453A',
    });
    expect(saved).toMatchObject({
      subject: 'QUÍMICA',
      endMinute: 600,
      color: '#FF453A',
    });
    expect(said()).toBe('Saved class QUÍMICA');
  });

  it('rejects updating a class that does not exist', async () => {
    await expect(
      w.planner.classes.update('cls_missing', { room: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes a class, announcing it only when something was deleted', async () => {
    const created = await w.planner.classes.create(input);
    await w.planner.classes.remove(created.id);
    expect(await w.classSessions.list()).toEqual([]);
    expect(said()).toBe('Deleted class FÍSICA');
    await w.planner.classes.remove(created.id);
    expect(said()).toBe('Deleted class FÍSICA');
  });
});

describe('schedule query', () => {
  it('lists classes by weekday then start and follows changes', async () => {
    await w.classSessions.create({
      ...input,
      subject: 'B',
      startMinute: 600,
      endMinute: 660,
    });
    await w.classSessions.create({ ...input, subject: 'A', dayOfWeek: 0 });
    const query = w.planner.queries.watchSchedule();
    const seen: string[][] = [];
    const stop = query.subscribe(() => {
      const state = query.getSnapshot();
      if (state.status === 'ready') {
        seen.push(state.data.classes.map(c => c.subject));
      }
    });
    await flushAsync();
    expect(query.getSnapshot()).toMatchObject({ status: 'ready' });
    await w.classSessions.create({
      ...input,
      subject: 'C',
      startMinute: 500,
      endMinute: 560,
    });
    await flushAsync();
    stop();
    expect(seen.at(-1)).toEqual(['A', 'C', 'B']);
  });
});
