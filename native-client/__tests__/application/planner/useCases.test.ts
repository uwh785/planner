import { NotFoundError, ValidationError } from '@/domain';
import { LIST_COLORS } from '@/application/planner/listColors';
import {
  openPlannerWorld,
  type PlannerWorld,
} from '../../helpers/plannerWorld';

let w: PlannerWorld;
beforeEach(async () => {
  w = await openPlannerWorld();
});
afterEach(() => w.db.close());

describe('list use cases', () => {
  it('creates a list with the next palette color and announces it', async () => {
    const a = await w.planner.lists.create('  Home ');
    const b = await w.planner.lists.create('Work');
    expect(a.name).toBe('Home');
    expect(a.color).toBe(LIST_COLORS[0]!.value);
    expect(b.color).toBe(LIST_COLORS[1]!.value);
    expect(w.planner.notices.getSnapshot()?.text).toBe('Added list Work');
  });

  it('keeps a chosen color and rejects a blank or too long name', async () => {
    const l = await w.planner.lists.create('X', '#FF0000');
    expect(l.color).toBe('#FF0000');
    await expect(w.planner.lists.create('   ')).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(w.planner.lists.create('x'.repeat(101))).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await w.taskLists.list()).toHaveLength(1);
  });

  it('renames and recolors, queuing one coalesced upsert', async () => {
    const l = await w.planner.lists.create('Old');
    await w.planner.lists.rename(l.id, ' New ');
    await w.planner.lists.recolor(l.id, LIST_COLORS[3]!.value);
    expect(await w.taskLists.get(l.id)).toMatchObject({
      name: 'New',
      color: LIST_COLORS[3]!.value,
    });
    expect(await w.outbox.pendingCount()).toBe(1);
  });

  it('rejects an unknown list', async () => {
    await expect(w.planner.lists.rename('lst_x', 'a')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(w.planner.lists.recolor('lst_x', '#000')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('deleting a list detaches its tasks and keeps them', async () => {
    const l = await w.planner.lists.create('L');
    const t = await w.planner.tasks.addQuick('inside', l.id);
    await w.planner.lists.remove(l.id);
    expect(await w.taskLists.get(l.id)).toBeNull();
    expect((await w.tasks.get(t.id))?.listId).toBeNull();
    expect(w.planner.notices.getSnapshot()?.text).toBe('Deleted list L');
  });
});

describe('task use cases', () => {
  it('quick add takes a title only and trims it', async () => {
    const t = await w.planner.tasks.addQuick('  Buy milk ', null);
    expect(t).toMatchObject({ title: 'Buy milk', listId: null, priority: 0 });
    expect(w.planner.notices.getSnapshot()?.text).toBe('Added Buy milk');
  });

  it('quick add into a list', async () => {
    const l = await w.planner.lists.create('L');
    const t = await w.planner.tasks.addQuick('a', l.id);
    expect(t.listId).toBe(l.id);
  });

  it('quick add rejects a blank title and a missing list', async () => {
    await expect(w.planner.tasks.addQuick('  ', null)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      w.planner.tasks.addQuick('a', 'lst_missing'),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await w.tasks.count()).toBe(0);
  });

  it('edits title, notes, priority, due date and list', async () => {
    const l = await w.planner.lists.create('L');
    const t = await w.planner.tasks.addQuick('a', null);
    const edited = await w.planner.tasks.edit(t.id, {
      title: ' b ',
      description: 'notes',
      priority: 3,
      dueDate: 86_400_000,
      dueAllDay: true,
      listId: l.id,
    });
    expect(edited).toMatchObject({
      title: 'b',
      description: 'notes',
      priority: 3,
      dueDate: 86_400_000,
      dueAllDay: true,
      listId: l.id,
    });
    expect(await w.tasks.get(t.id)).toEqual(edited);
  });

  it('clears the due date and moves out of a list', async () => {
    const l = await w.planner.lists.create('L');
    const t = await w.planner.tasks.addQuick('a', l.id);
    await w.planner.tasks.edit(t.id, { dueDate: 5, dueAllDay: false });
    const cleared = await w.planner.tasks.edit(t.id, {
      dueDate: null,
      dueAllDay: false,
      listId: null,
    });
    expect(cleared).toMatchObject({ dueDate: null, listId: null });
  });

  it('validates priority, due date and notes with the domain rules', async () => {
    const t = await w.planner.tasks.addQuick('a', null);
    await expect(
      w.planner.tasks.edit(t.id, { priority: 4 as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      w.planner.tasks.edit(t.id, { dueDate: Number.NaN }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      w.planner.tasks.edit(t.id, { title: ' ' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      w.planner.tasks.edit(t.id, { description: 'x'.repeat(5001) }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await w.tasks.get(t.id))?.priority).toBe(0);
  });

  it('rejects edits of a missing task or into a missing list', async () => {
    await expect(
      w.planner.tasks.edit('tsk_x', { title: 'a' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const t = await w.planner.tasks.addQuick('a', null);
    await expect(
      w.planner.tasks.edit(t.id, { listId: 'lst_gone' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes a task and announces it', async () => {
    const t = await w.planner.tasks.addQuick('gone', null);
    await w.planner.tasks.remove(t.id);
    expect(await w.tasks.get(t.id)).toBeNull();
    expect(w.planner.notices.getSnapshot()?.text).toBe('Deleted gone');
  });

  it('deleting a missing task is a quiet no-op', async () => {
    await expect(w.planner.tasks.remove('tsk_x')).resolves.toBeUndefined();
  });
});

describe('notices', () => {
  it('replaces the message, numbers each one and clears it after a while', () => {
    const { notices } = w.planner;
    notices.announce('One');
    const first = notices.getSnapshot()!;
    notices.announce('One');
    const second = notices.getSnapshot()!;
    expect(second.id).toBeGreaterThan(first.id);
    w.timer.advance(6_000);
    expect(notices.getSnapshot()).toBeNull();
  });

  it('a newer message is not cleared by the timer of an older one', () => {
    const { notices } = w.planner;
    notices.announce('A');
    w.timer.advance(4_000);
    notices.announce('B');
    w.timer.advance(2_000);
    expect(notices.getSnapshot()?.text).toBe('B');
    w.timer.advance(4_000);
    expect(notices.getSnapshot()).toBeNull();
  });
});
