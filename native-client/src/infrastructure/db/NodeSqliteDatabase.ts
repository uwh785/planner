/**
 * Test-only adapter over Node's built-in `node:sqlite`. Never import this from
 * app code: Metro cannot resolve `node:sqlite` and it is not in the bundle
 * because nothing in the app graph references it (enforced by a Jest test).
 */
import { DatabaseSync } from 'node:sqlite';
import type { SqlValue } from '@/application/ports/SqlDatabase';
import { BaseSqlDatabase, type SqlStatementResult } from './BaseSqlDatabase';

export class NodeSqliteDatabase extends BaseSqlDatabase {
  private constructor(private readonly db: DatabaseSync) {
    super();
  }

  static openInMemory(): NodeSqliteDatabase {
    return new NodeSqliteDatabase(new DatabaseSync(':memory:'));
  }

  protected async run(
    sql: string,
    params: readonly SqlValue[],
  ): Promise<SqlStatementResult> {
    const statement = this.db.prepare(sql);
    if (statement.columns().length > 0) {
      const rows = statement.all(...params).map(row => ({ ...row }));
      return { rows, rowsAffected: 0 };
    }
    const { changes } = statement.run(...params);
    return { rows: [], rowsAffected: Number(changes) };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
