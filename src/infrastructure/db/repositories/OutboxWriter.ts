import type { Clock } from '@/application/ports/Clock';
import type { IdGenerator } from '@/application/ports/IdGenerator';
import type {
  OutboxEntity,
  OutboxOrigin,
} from '@/application/ports/OutboxRepository';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';

interface PendingRow {
  id: number;
  op: string;
  origin: string;
}

const PENDING = "status = 'pending'";

/**
 * Queues outbox entries, always on the transaction handle of the data change
 * so the row and its entry commit or roll back together, and coalesces them:
 *
 * - at most one pending upsert per entity, updated in place so its id (the
 *   ordering key) and change id stay stable;
 * - deleting an entity whose pending entry has origin `create` (the server
 *   never saw it) drops every entry for it and reports `dropped`;
 * - deleting any other entity drops its pending upserts and queues one delete.
 */
export class OutboxWriter {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  private pending(tx: SqlDatabase, entity: OutboxEntity, entityId: string) {
    return tx.query<PendingRow>(
      `SELECT id, op, origin FROM outbox WHERE entity = ? AND entity_id = ? AND ${PENDING} ORDER BY id`,
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
    op: 'upsert' | 'delete',
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
   * pending upsert exists yet; otherwise the existing entry keeps its own.
   * A pending delete of the same entity (a task/tag link being re-added) is
   * replaced by the upsert.
   */
  async upsert(
    tx: SqlDatabase,
    entity: OutboxEntity,
    entityId: string,
    payload: Record<string, unknown>,
    origin: OutboxOrigin,
  ): Promise<void> {
    const entries = await this.pending(tx, entity, entityId);
    await this.remove(
      tx,
      entries.filter(e => e.op === 'delete').map(e => e.id),
    );
    const [keep, ...extra] = entries.filter(e => e.op === 'upsert');
    if (keep === undefined) {
      await this.insert(tx, entity, 'upsert', entityId, payload, origin);
      return;
    }
    await tx.execute('UPDATE outbox SET payload = ? WHERE id = ?', [
      JSON.stringify(payload),
      keep.id,
    ]);
    await this.remove(
      tx,
      extra.map(e => e.id),
    );
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
    const entries = await this.pending(tx, entity, entityId);
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
      entries.filter(e => e.op === 'upsert').map(e => e.id),
    );
    if (!entries.some(e => e.op === 'delete')) {
      await this.insert(tx, entity, 'delete', entityId, payload, 'update');
    }
    return 'queued';
  }

  /** Forgets every pending entry of an entity (its parent was never pushed). */
  async discard(
    tx: SqlDatabase,
    entity: OutboxEntity,
    entityId: string,
  ): Promise<void> {
    await tx.execute(
      `DELETE FROM outbox WHERE entity = ? AND entity_id = ? AND ${PENDING}`,
      [entity, entityId],
    );
  }
}
