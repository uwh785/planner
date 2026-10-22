import type { ChangeNotifier } from '@/application/ports/ChangeNotifier';
import type {
  SqlDatabase,
  SqlRunResult,
  SqlValue,
} from '@/application/ports/SqlDatabase';

/**
 * The database the repositories write through. After a top-level transaction
 * has committed it tells the notifier, so the sync scheduler hears about
 * local changes only once they are durable. A transaction that rolls back, or
 * one nested inside another, notifies nothing; the outer one does. Reads and
 * plain statements pass straight through.
 */
export class NotifyingDatabase implements SqlDatabase {
  constructor(
    private readonly inner: SqlDatabase,
    private readonly notifier: ChangeNotifier,
  ) {}

  execute(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult> {
    return this.inner.execute(sql, params);
  }

  query<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]> {
    return this.inner.query<T>(sql, params);
  }

  async transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    const result = await this.inner.transaction(fn);
    this.notifier.notifyChange();
    return result;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}
