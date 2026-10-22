import { parsePullResponse } from '@/application/sync/parsePullResponse';

describe('parsePullResponse', () => {
  it('maps snake_case rows to domain types and normalizes list_id', () => {
    const parsed = parsePullResponse({
      cursor: 5,
      tasks: [
        {
          task_id: 'tsk_a',
          list_id: '',
          title: 't',
          priority: 2,
          status: 'in_progress',
          updated_at: 3,
          deleted: 0,
          due_all_day: 1,
        },
      ],
    });
    expect(parsed.cursor).toBe(5);
    expect(parsed.tasks.rows[0]).toMatchObject({
      id: 'tsk_a',
      listId: null,
      priority: 2,
      status: 'in_progress',
      dueAllDay: true,
      deleted: false,
      updatedAt: 3,
      description: '',
    });
  });

  it('treats absent or wrongly typed collections as empty', () => {
    const parsed = parsePullResponse({ tasks: 'x', lists: {}, events: null });
    expect(parsed.cursor).toBeNull();
    expect(parsed.tasks).toEqual({ rows: [], invalid: 0 });
    expect(parsed.lists).toEqual({ rows: [], invalid: 0 });
    expect(parsed.events).toEqual({ rows: [], invalid: 0 });
  });

  it('ignores a non-finite cursor', () => {
    expect(parsePullResponse({ cursor: 'abc' }).cursor).toBeNull();
    expect(parsePullResponse({ cursor: -1 }).cursor).toBeNull();
  });

  it('throws for a non-object body', () => {
    expect(() => parsePullResponse([])).toThrow(/pull response/i);
    expect(() => parsePullResponse(undefined)).toThrow(/pull response/i);
  });

  it('counts rows missing a required key as invalid', () => {
    const parsed = parsePullResponse({
      subtasks: [
        { subtask_id: 'sub_a' },
        { subtask_id: 'sub_b', task_id: 'tsk_a', title: 'x' },
      ],
      task_tags: [{ task_id: 'tsk_a' }],
    });
    expect(parsed.subtasks.rows).toHaveLength(1);
    expect(parsed.subtasks.invalid).toBe(1);
    expect(parsed.taskTags.invalid).toBe(1);
  });
});
