import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { OpSqliteDatabase } from './OpSqliteDatabase';
import { migrations as shippedMigrations } from './migrations';
import { runMigrations, type Migration } from './migrations/runner';

export interface InitializedDatabase {
  db: SqlDatabase;
  schemaVersion: number;
}

/**
 * Opens the named database file and brings its schema up to date. If a
 * migration fails the connection is closed before the error is rethrown.
 * `migrations` is for tests.
 */
export async function initDatabase(
  fileName: string,
  options: { migrations?: readonly Migration[] } = {},
): Promise<InitializedDatabase> {
  const db = OpSqliteDatabase.open(fileName);
  try {
    const schemaVersion = await runMigrations(
      db,
      options.migrations ?? shippedMigrations,
    );
    return { db, schemaVersion };
  } catch (error) {
    await db.close().catch(() => undefined);
    throw error;
  }
}
