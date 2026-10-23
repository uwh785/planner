import type { Clock } from '@/application/ports/Clock';
import type { IdGenerator } from '@/application/ports/IdGenerator';
import type {
  OutboxEntity,
  OutboxOp,
  OutboxOrigin,
} from '@/application/ports/OutboxRepository';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';

interface EntryRow {
  id: number;
  op: string;
  origin: string;
  status: string;
}

/**
 * Queues outbox entries, always on the transaction handle of the data change
 * so the row and its entry commit or roll back together, and coalesces them:
 *
 * - at most one upsert per entity, updated in place so its id (the ordering
 *   key) and change id stay stable; if it was parked (blocked or rejected) the
 *   edit revives it as pending with its attempts reset;
 * - a task's `complete` is queued at most once (a parked one stays as it is);
 *   it never touches the task's upsert, which keeps its place before it;
 * - deleting an entity whose upsert has origin `create` (the server never saw
 *   it, parked or not) drops every entry for it and reports `dropped`;
 * - deleting any other entity drops its upserts and completions and queues
 *   one delete.
 *
 * Parked entries are included everywhere below, so an entity never ends up
 * with a parked entry and a second one beside it.
 */
export class OutboxWriter {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  private entries(tx: SqlDatabase, entity: OutboxEntity, entityId: string) {
    return tx.query<EntryRow>(
      'SELECT id, op, origin, status FROM outbox WHERE entity = ? AND entity_id = ? ORDER BY id',
      [entity, entityId],
    );
  }

  private async remove(tx: SqlDatabase, ids: number[]): Promise<void> {
    for (const id of ids) {
      await tx.execute('DELETE FROM outbox WHERE id = ?', [id]);
    }
  }

  private insert(
    tx: SqlDatabase,
    entity: OutboxEntity,
    op: OutboxOp,
    entityId: string,
    payload: Record<string, unknown>,
    origin: OutboxOrigin,
  ) {
    return tx.execute(
      `INSERT INTO outbox (entity, op, entity_id, payload, change_id, created_at, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entity,
        op,
        entityId,
        JSON.stringify(payload),
        this.ids.newChangeId(),
        this.clock.now(),
        origin,
      ],
    );
  }

  /**
   * Queues the full current body of an entity. `origin` is used only when no
   * upsert exists yet; otherwise the existing entry keeps its own (and is
   * revived to pending if it was parked). A delete of the same entity (a
   * task/tag link being re-added) is replaced by the upsert.
   */
  async upsert(
    tx: SqlDatabase,
    entity: OutboxEntity,
    entityId: string,
    payload: Record<string, unknown>,
    origin: OutboxOrigin,
  ): Promise<void> {
    const entries = await this.entries(tx, entity, entityId);
    await this.remove(
      tx,
      entries.filter(e => e.op === 'delete').map(e => e.id),
    );
    const upserts = entries.filter(e => e.op === 'upsert');
    const keep = upserts.find(e => e.status === 'pending') ?? upserts[0];
    const extra = upserts.filter(e => e !== keep);
    if (keep === undefined) {
      await this.insert(tx, entity, 'upsert', entityId, payload, origin);
      return;
    }
    const revive = keep.status !== 'pending';
    await tx.execute(
      revive
        ? "UPDATE outbox SET payload = ?, status = 'pending', attempts = 0, last_error = NULL WHERE id = ?"
        : 'UPDATE outbox SET payload = ? WHERE id = ?',
      [JSON.stringify(payload), keep.id],
    );
    await this.remove(
      tx,
      extra.map(e => e.id),
    );
  }

  /**
   * Queues the timer op `complete` of a task, with the moment it happened.
   * Does nothing when a completion is already queued, parked or not: the
   * first moment wins, and a parked one waits for the user's retry.
   */
  async complete(tx: SqlDatabase, entityId: string, at: number): Promise<void> {
    const entries = await this.entries(tx, 'task', entityId);
    if (entries.some(e => e.op === 'complete')) {
      return;
    }
    await this.insert(tx, 'task', 'complete', entityId, { at }, 'update');
  }

  /**
   * Queues the deletion of an entity. Returns `dropped` when the server never
   * saw it (nothing queued, the caller hard-deletes the local row) or
   * `queued` when a delete entry now waits for a push.
   */
  async delete(
    tx: SqlDatabase,
    entity: OutboxEntity,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<'dropped' | 'queued'> {
    const entries = await this.entries(tx, entity, entityId);
    const neverPushed = entries.some(
      e => e.op === 'upsert' && e.origin === 'create',
    );
    if (neverPushed) {
      await this.remove(
        tx,
        entries.map(e => e.id),
      );
      return 'dropped';
    }
    await this.remove(
      tx,
      entries
        .filter(e => e.op === 'upsert' || e.op === 'complete')
        .map(e => e.id),
    );
    if (!entries.some(e => e.op === 'delete' && e.status === 'pending')) {
      await this.insert(tx, entity, 'delete', entityId, payload, 'update');
    }
    return 'queued';
  }

  /** Forgets every entry of an entity, parked or not (its parent was never pushed). */
  async discard(
    tx: SqlDatabase,
    entity: OutboxEntity,
    entityId: string,
  ): Promise<void> {
    await tx.execute('DELETE FROM outbox WHERE entity = ? AND entity_id = ?', [
      entity,
      entityId,
    ]);
  }
}
