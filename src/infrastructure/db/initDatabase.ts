import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { OpSqliteDatabase } from './OpSqliteDatabase';
import { migrations } from './migrations';
import { runMigrations } from './migrations/runner';

export interface InitializedDatabase {
  db: SqlDatabase;
  schemaVersion: number;
}

/** Opens the named database file and brings its schema up to date. */
export async function initDatabase(
  fileName: string,
): Promise<InitializedDatabase> {
  const db = OpSqliteDatabase.open(fileName);
  try {
    const schemaVersion = await runMigrations(db, migrations);
    return { db, schemaVersion };
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }
}
