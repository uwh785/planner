import type { OutboxEntity } from '@/application/ports/OutboxRepository';
import type {
  ApplyRemoteChanges,
  ApplyResult,
} from '@/application/ports/RemoteChanges';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { taskTagEntityId } from '@/application/sync/entityIds';
import {
  parsePullResponse,
  type Parsed,
} from '@/application/sync/parsePullResponse';
import {
  classSessionToRow,
  eventToRow,
  subtaskToRow,
  tagToRow,
  taskListToRow,
  taskTagToRow,
  taskToRow,
} from '../mappers';
import { upsertRow } from './sqlHelpers';
import { CURSOR_KEY, writeSyncState } from './SyncStateSqlRepository';

/**
 * Applies a pull in one transaction. A row with a pending outbox entry is
 * skipped: the local edit wins until it is pushed and the next pull
 * reconciles. There are no foreign keys, so rows may arrive children first.
 */
export class RemoteChangesApplier implements ApplyRemoteChanges {
  constructor(private readonly db: SqlDatabase) {}

  async applyRemoteChanges(response: unknown): Promise<ApplyResult> {
    const pull = parsePullResponse(response);
    const result: ApplyResult = { applied: 0, skippedPending: 0, invalid: 0 };

    await this.db.transaction(async tx => {
      const apply = async <T>(
        parsed: Parsed<T>,
        entity: OutboxEntity,
        table: string,
        keys: readonly string[],
        idOf: (row: T) => string,
        toRow: (row: T) => object,
      ) => {
        result.invalid += parsed.invalid;
        if (parsed.rows.length === 0) {
          return;
        }
        const pending = new Set(
          (
            await tx.query<{ entity_id: string }>(
              "SELECT entity_id FROM outbox WHERE entity = ? AND status = 'pending'",
              [entity],
            )
          ).map(r => r.entity_id),
        );
        for (const row of parsed.rows) {
          if (pending.has(idOf(row))) {
            result.skippedPending += 1;
            continue;
          }
          await upsertRow(tx, table, toRow(row), keys);
          result.applied += 1;
        }
      };

      await apply(
        pull.lists,
        'list',
        'task_lists',
        ['list_id'],
        r => r.id,
        taskListToRow,
      );
      await apply(pull.tags, 'tag', 'tags', ['tag_id'], r => r.id, tagToRow);
      await apply(
        pull.tasks,
        'task',
        'tasks',
        ['task_id'],
        r => r.id,
        taskToRow,
      );
      await apply(
        pull.subtasks,
        'subtask',
        'subtasks',
        ['subtask_id'],
        r => r.id,
        subtaskToRow,
      );
      await apply(
        pull.classes,
        'class',
        'class_sessions',
        ['class_id'],
        r => r.id,
        classSessionToRow,
      );
      await apply(
        pull.events,
        'event',
        'events',
        ['event_id'],
        r => r.id,
        eventToRow,
      );
      await apply(
        pull.taskTags,
        'task_tag',
        'task_tags',
        ['task_id', 'tag_id'],
        r => taskTagEntityId(r.taskId, r.tagId),
        taskTagToRow,
      );

      if (pull.cursor !== null) {
        await writeSyncState(tx, CURSOR_KEY, pull.cursor);
      }
    });
    return result;
  }
}
