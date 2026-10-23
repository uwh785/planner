import type { Clock } from '@/application/ports/Clock';
import type { OutboxEntity } from '@/application/ports/OutboxRepository';
import type { SqlDatabase, SqlValue } from '@/application/ports/SqlDatabase';
import type { SyncMeta } from '@/domain';
import type { OutboxWriter } from './OutboxWriter';
import { insertRow, updateRow } from './sqlHelpers';

export interface EntityDef<T extends SyncMeta, R extends object> {
  entity: OutboxEntity;
  table: string;
  idColumn: string;
  idOf(item: T): string;
  toRow(item: T): R;
  fromRow(row: R): T;
  /** Trims, applies defaults and throws ValidationError like the backend. */
  normalize(item: T): T;
  payload(item: T): Record<string, unknown>;
  deletePayload(item: T): Record<string, unknown>;
}

export interface DeleteHooks<T> {
  /** Runs before the delete is queued, in the same transaction. */
  before?(tx: SqlDatabase, item: T): Promise<void>;
  /** `dropped`: the server never saw the item, so its row was hard-deleted. */
  after?(tx: SqlDatabase, item: T, dropped: boolean): Promise<void>;
}

/**
 * The write path shared by every synced entity: change the local row and queue
 * the outbox entry in one transaction, so neither can exist without the other.
 */
export class EntityStore<T extends SyncMeta, R extends object> {
  constructor(
    private readonly db: SqlDatabase,
    private readonly def: EntityDef<T, R>,
    private readonly outbox: OutboxWriter,
    private readonly clock: Clock,
  ) {}

  private async findIn(
    db: SqlDatabase,
    id: string,
    live = true,
  ): Promise<T | null> {
    const [row] = await db.query<R>(
      `SELECT * FROM ${this.def.table} WHERE ${this.def.idColumn} = ?${
        live ? ' AND deleted = 0' : ''
      }`,
      [id],
    );
    return row === undefined ? null : this.def.fromRow(row);
  }

  get(id: string): Promise<T | null> {
    return this.findIn(this.db, id);
  }

  async select(
    where: string,
    params: readonly SqlValue[],
    orderBy: string,
    limit?: number,
  ): Promise<T[]> {
    const capped = limit === undefined ? '' : ' LIMIT ?';
    const rows = await this.db.query<R>(
      `SELECT * FROM ${this.def.table} WHERE deleted = 0${
        where ? ` AND ${where}` : ''
      } ORDER BY ${orderBy}${capped}`,
      limit === undefined
        ? params
        : [...params, Math.max(0, Math.floor(limit))],
    );
    return rows.map(r => this.def.fromRow(r));
  }

  async count(where: string, params: readonly SqlValue[]): Promise<number> {
    const [row] = await this.db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${this.def.table} WHERE deleted = 0${
        where ? ` AND ${where}` : ''
      }`,
      params,
    );
    return row?.n ?? 0;
  }

  async create(
    build: (now: number) => T,
    guard?: (tx: SqlDatabase) => Promise<void>,
  ): Promise<T> {
    const now = this.clock.now();
    const item = this.def.normalize({
      ...build(now),
      updatedAt: now,
      deleted: false,
    });
    await this.db.transaction(async tx => {
      await guard?.(tx);
      await insertRow(tx, this.def.table, this.def.toRow(item));
      await this.outbox.upsert(
        tx,
        this.def.entity,
        this.def.idOf(item),
        this.def.payload(item),
        'create',
      );
    });
    return item;
  }

  update(id: string, apply: (current: T) => T): Promise<T | null> {
    return this.db.transaction(tx => this.updateIn(tx, id, apply));
  }

  /** Same as update, inside a transaction the caller already holds. */
  async updateIn(
    tx: SqlDatabase,
    id: string,
    apply: (current: T) => T,
  ): Promise<T | null> {
    const current = await this.findIn(tx, id);
    if (current === null) {
      return null;
    }
    const next = this.def.normalize({
      ...apply(current),
      updatedAt: this.clock.now(),
      deleted: false,
    });
    await updateRow(
      tx,
      this.def.table,
      this.def.idColumn,
      this.def.toRow(next),
    );
    // Origin only matters when no entry is pending; an update never creates.
    await this.outbox.upsert(
      tx,
      this.def.entity,
      id,
      this.def.payload(next),
      'update',
    );
    return next;
  }

  /**
   * Changes a live row and queues something other than an upsert for it (a
   * timer op), in one transaction. `apply` returns the next state, or null
   * when there is nothing to do (the current row is returned, nothing is
   * queued). Resolves to null when the row does not exist.
   */
  transition(
    id: string,
    apply: (current: T) => T | null,
    queue: (tx: SqlDatabase, next: T) => Promise<void>,
  ): Promise<T | null> {
    return this.db.transaction(async tx => {
      const current = await this.findIn(tx, id);
      if (current === null) {
        return null;
      }
      const changed = apply(current);
      if (changed === null) {
        return current;
      }
      const next = this.def.normalize({
        ...changed,
        updatedAt: this.clock.now(),
        deleted: false,
      });
      await updateRow(
        tx,
        this.def.table,
        this.def.idColumn,
        this.def.toRow(next),
      );
      await queue(tx, next);
      return next;
    });
  }

  delete(id: string, hooks: DeleteHooks<T> = {}): Promise<boolean> {
    return this.db.transaction(async tx => {
      const current = await this.findIn(tx, id);
      if (current === null) {
        return false;
      }
      await hooks.before?.(tx, current);
      const outcome = await this.outbox.delete(
        tx,
        this.def.entity,
        id,
        this.def.deletePayload(current),
      );
      if (outcome === 'dropped') {
        await tx.execute(
          `DELETE FROM ${this.def.table} WHERE ${this.def.idColumn} = ?`,
          [id],
        );
      } else {
        await tx.execute(
          `UPDATE ${this.def.table} SET deleted = 1, updated_at = ? WHERE ${this.def.idColumn} = ?`,
          [this.clock.now(), id],
        );
      }
      await hooks.after?.(tx, current, outcome === 'dropped');
      return true;
    });
  }
}
