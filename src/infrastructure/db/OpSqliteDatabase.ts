import { open, type DB } from '@op-engineering/op-sqlite';
import type { SqlValue } from '@/application/ports/SqlDatabase';
import { BaseSqlDatabase, type SqlStatementResult } from './BaseSqlDatabase';

/**
 * Production adapter over op-sqlite. `name` is the database file (one per
 * signed-in user, see databaseFileName), stored in the app's private
 * databases directory. Transactions are plain BEGIN/COMMIT on the single
 * connection, queued by BaseSqlDatabase, so op-sqlite's own transaction
 * helper is not used.
 */
export class OpSqliteDatabase extends BaseSqlDatabase {
  private constructor(private readonly db: DB) {
    super();
  }

  static open(name: string): OpSqliteDatabase {
    return new OpSqliteDatabase(open({ name }));
  }

  protected async run(
    sql: string,
    params: readonly SqlValue[],
  ): Promise<SqlStatementResult> {
    const result = await this.db.execute(sql, [...params]);
    return { rows: result.rows, rowsAffected: result.rowsAffected };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
