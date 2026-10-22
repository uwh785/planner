import type {
  NewTag,
  TagPatch,
  TagRepository,
} from '@/application/ports/repositories';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { taskTagEntityId } from '@/application/sync/entityIds';
import { NotFoundError, normalizeTag, type Tag } from '@/domain';
import { tagFromRow, tagToRow } from '../mappers';
import type { TagRow, TaskTagRow } from '../rows';
import type { RepoDeps } from './deps';
import { EntityStore } from './EntityStore';
import { tagPayload, taskTagPayload } from './payloads';
import { insertRow, merge } from './sqlHelpers';

/**
 * Tags and their links to tasks. A link has no id of its own: it is the pair
 * (task_id, tag_id), queued as entity `task_tag` with entity id
 * `<task_id>:<tag_id>`.
 */
export class TagSqlRepository implements TagRepository {
  private readonly store: EntityStore<Tag, TagRow>;

  constructor(private readonly deps: RepoDeps) {
    this.store = new EntityStore(
      deps.db,
      {
        entity: 'tag',
        table: 'tags',
        idColumn: 'tag_id',
        idOf: t => t.id,
        toRow: tagToRow,
        fromRow: tagFromRow,
        normalize: normalizeTag,
        payload: tagPayload,
        deletePayload: () => ({}),
      },
      deps.outbox,
      deps.clock,
    );
  }

  create(input: NewTag) {
    return this.store.create(now => ({
      id: this.deps.ids.newId('tag'),
      name: input.name,
      color: input.color ?? '',
      updatedAt: now,
      deleted: false,
    }));
  }

  update(id: string, patch: TagPatch) {
    return this.store.update(id, current => merge(current, patch));
  }

  /**
   * Mirrors the backend's DeleteTag, which also tombstones the tag's links:
   * locally the links are tombstoned without queuing them. A tag the server
   * never saw takes its (necessarily unpushed) links with it.
   */
  delete(id: string) {
    return this.store.delete(id, {
      after: async (tx, tag, dropped) => {
        if (dropped) {
          await this.purgeLinks(tx, tag.id);
        } else {
          await tx.execute(
            'UPDATE task_tags SET deleted = 1, updated_at = ? WHERE tag_id = ? AND deleted = 0',
            [this.deps.clock.now(), tag.id],
          );
        }
      },
    });
  }

  get(id: string) {
    return this.store.get(id);
  }

  list() {
    return this.store.select('', [], 'name COLLATE NOCASE, tag_id');
  }

  async tagsForTask(taskId: string) {
    const rows = await this.deps.db.query<TagRow>(
      `SELECT t.* FROM task_tags tt JOIN tags t ON t.tag_id = tt.tag_id
       WHERE tt.task_id = ? AND tt.deleted = 0 AND t.deleted = 0
       ORDER BY t.name COLLATE NOCASE, t.tag_id`,
      [taskId],
    );
    return rows.map(tagFromRow);
  }

  addToTask(taskId: string, tagId: string): Promise<void> {
    return this.deps.db.transaction(async tx => {
      await this.requireLive(tx, 'tasks', 'task_id', taskId, 'Task');
      await this.requireLive(tx, 'tags', 'tag_id', tagId, 'Tag');
      const [existing] = await tx.query<TaskTagRow>(
        'SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ?',
        [taskId, tagId],
      );
      if (existing !== undefined && existing.deleted === 0) {
        return;
      }
      const now = this.deps.clock.now();
      if (existing === undefined) {
        await insertRow(tx, 'task_tags', {
          task_id: taskId,
          tag_id: tagId,
          updated_at: now,
          deleted: 0,
        });
      } else {
        await tx.execute(
          'UPDATE task_tags SET deleted = 0, updated_at = ? WHERE task_id = ? AND tag_id = ?',
          [now, taskId, tagId],
        );
      }
      // A tombstone means the server knows the link, so this is an update.
      await this.deps.outbox.upsert(
        tx,
        'task_tag',
        taskTagEntityId(taskId, tagId),
        taskTagPayload(taskId, tagId),
        existing === undefined ? 'create' : 'update',
      );
    });
  }

  removeFromTask(taskId: string, tagId: string): Promise<void> {
    return this.deps.db.transaction(async tx => {
      const [existing] = await tx.query<TaskTagRow>(
        'SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ? AND deleted = 0',
        [taskId, tagId],
      );
      if (existing === undefined) {
        return;
      }
      const outcome = await this.deps.outbox.delete(
        tx,
        'task_tag',
        taskTagEntityId(taskId, tagId),
        taskTagPayload(taskId, tagId),
      );
      if (outcome === 'dropped') {
        await tx.execute(
          'DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?',
          [taskId, tagId],
        );
      } else {
        await tx.execute(
          'UPDATE task_tags SET deleted = 1, updated_at = ? WHERE task_id = ? AND tag_id = ?',
          [this.deps.clock.now(), taskId, tagId],
        );
      }
    });
  }

  private async requireLive(
    tx: SqlDatabase,
    table: string,
    column: string,
    id: string,
    label: string,
  ): Promise<void> {
    const rows = await tx.query(
      `SELECT 1 FROM ${table} WHERE ${column} = ? AND deleted = 0`,
      [id],
    );
    if (rows.length === 0) {
      throw new NotFoundError(`${label} not found`);
    }
  }

  private async purgeLinks(tx: SqlDatabase, tagId: string): Promise<void> {
    const links = await tx.query<{ task_id: string }>(
      'SELECT task_id FROM task_tags WHERE tag_id = ?',
      [tagId],
    );
    for (const { task_id } of links) {
      await this.deps.outbox.discard(
        tx,
        'task_tag',
        taskTagEntityId(task_id, tagId),
      );
    }
    await tx.execute('DELETE FROM task_tags WHERE tag_id = ?', [tagId]);
  }
}
