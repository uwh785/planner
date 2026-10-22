import type {
  SqlDatabase,
  SqlRunResult,
  SqlValue,
} from '@/application/ports/SqlDatabase';

export interface SqlStatementResult extends SqlRunResult {
  rows: unknown[];
}

type Run = (
  sql: string,
  params: readonly SqlValue[],
) => Promise<SqlStatementResult>;

/** The handle given to a transaction callback; nesting uses savepoints. */
class TransactionHandle implements SqlDatabase {
  private open = true;
  private savepoints = 0;

  constructor(private readonly run: Run) {}

  finish(): void {
    this.open = false;
  }

  private assertOpen(): void {
    if (!this.open) {
      throw new Error('Transaction already finished');
    }
  }

  async execute(sql: string, params: readonly SqlValue[] = []) {
    this.assertOpen();
    const { rowsAffected } = await this.run(sql, params);
    return { rowsAffected };
  }

  async query<T>(sql: string, params: readonly SqlValue[] = []) {
    this.assertOpen();
    return (await this.run(sql, params)).rows as T[];
  }

  async transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    this.assertOpen();
    const name = `sp_${++this.savepoints}`;
    await this.run(`SAVEPOINT ${name}`, []);
    try {
      const result = await fn(this);
      await this.run(`RELEASE ${name}`, []);
      return result;
    } catch (error) {
      await this.run(`ROLLBACK TO ${name}`, []).catch(() => undefined);
      await this.run(`RELEASE ${name}`, []).catch(() => undefined);
      throw error;
    }
  }

  close(): Promise<never> {
    return Promise.reject(new Error('Cannot close inside a transaction'));
  }
}

/**
 * Shared behavior of the SQL adapters: a FIFO queue so statements never
 * interleave with an open transaction on the single connection, and
 * BEGIN/COMMIT/ROLLBACK handling. Subclasses only run one statement.
 */
export abstract class BaseSqlDatabase implements SqlDatabase {
  private tail: Promise<unknown> = Promise.resolve();

  protected abstract run(
    sql: string,
    params: readonly SqlValue[],
  ): Promise<SqlStatementResult>;

  abstract close(): Promise<void>;

  private exclusive<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(job);
    this.tail = result.catch(() => undefined);
    return result;
  }

  execute(sql: string, params: readonly SqlValue[] = []) {
    return this.exclusive(async () => {
      const { rowsAffected } = await this.run(sql, params);
      return { rowsAffected };
    });
  }

  query<T>(sql: string, params: readonly SqlValue[] = []) {
    return this.exclusive(
      async () => (await this.run(sql, params)).rows as T[],
    );
  }

  transaction<T>(fn: (tx: SqlDatabase) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      const run: Run = (sql, params) => this.run(sql, params);
      await run('BEGIN', []);
      const handle = new TransactionHandle(run);
      try {
        const result = await fn(handle);
        await run('COMMIT', []);
        return result;
      } catch (error) {
        await run('ROLLBACK', []).catch(() => undefined);
        throw error;
      } finally {
        handle.finish();
      }
    });
  }
}
