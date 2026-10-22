import type {
  OutboxEntity,
  OutboxEntry,
  OutboxOp,
  OutboxOrigin,
  OutboxRepository,
  OutboxStatus,
  ParkedStatus,
} from '@/application/ports/OutboxRepository';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';

interface OutboxDbRow {
  id: number;
  entity: string;
  op: string;
  entity_id: string;
  payload: string;
  change_id: string;
  origin: string;
  status: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
}

const toEntry = (r: OutboxDbRow): OutboxEntry => ({
  id: r.id,
  entity: r.entity as OutboxEntity,
  op: r.op as OutboxOp,
  entityId: r.entity_id,
  payload: JSON.parse(r.payload) as Record<string, unknown>,
  changeId: r.change_id,
  origin: r.origin as OutboxOrigin,
  status: r.status as OutboxStatus,
  createdAt: r.created_at,
  attempts: r.attempts,
  lastError: r.last_error,
});

export class OutboxSqlRepository implements OutboxRepository {
  constructor(private readonly db: SqlDatabase) {}

  async peekPending(limit: number): Promise<OutboxEntry[]> {
    if (limit <= 0) {
      return [];
    }
    const rows = await this.db.query<OutboxDbRow>(
      "SELECT * FROM outbox WHERE status = 'pending' ORDER BY id LIMIT ?",
      [Math.floor(limit)],
    );
    return rows.map(toEntry);
  }

  async markSent(ids: readonly number[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.db.transaction(async tx => {
      for (const id of ids) {
        await tx.execute('DELETE FROM outbox WHERE id = ?', [id]);
      }
    });
  }

  async recordAttempt(id: number, error: string): Promise<void> {
    await this.db.execute(
      'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?',
      [error, id],
    );
  }

  async park(id: number, status: ParkedStatus, error: string): Promise<void> {
    await this.db.execute(
      'UPDATE outbox SET status = ?, last_error = ? WHERE id = ?',
      [status, error, id],
    );
  }

  async pendingCount(): Promise<number> {
    const [row] = await this.db.query<{ n: number }>(
      "SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'",
    );
    return row?.n ?? 0;
  }

  async pendingByEntity(entity: OutboxEntity): Promise<OutboxEntry[]> {
    const rows = await this.db.query<OutboxDbRow>(
      "SELECT * FROM outbox WHERE entity = ? AND status = 'pending' ORDER BY id",
      [entity],
    );
    return rows.map(toEntry);
  }

  async countByStatus(): Promise<Record<OutboxStatus, number>> {
    const rows = await this.db.query<{ status: string; n: number }>(
      'SELECT status, COUNT(*) AS n FROM outbox GROUP BY status',
    );
    const counts: Record<OutboxStatus, number> = {
      pending: 0,
      blocked: 0,
      rejected: 0,
    };
    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status as OutboxStatus] = row.n;
      }
    }
    return counts;
  }

  async listParked(): Promise<OutboxEntry[]> {
    const rows = await this.db.query<OutboxDbRow>(
      "SELECT * FROM outbox WHERE status <> 'pending' ORDER BY id",
    );
    return rows.map(toEntry);
  }

  async retryParked(ids?: readonly number[]): Promise<number> {
    const revive =
      "UPDATE outbox SET status = 'pending', attempts = 0, last_error = NULL WHERE status <> 'pending'";
    if (ids === undefined) {
      return (await this.db.execute(revive)).rowsAffected;
    }
    return this.db.transaction(async tx => {
      let moved = 0;
      for (const id of ids) {
        moved += (await tx.execute(`${revive} AND id = ?`, [id])).rowsAffected;
      }
      return moved;
    });
  }
}
