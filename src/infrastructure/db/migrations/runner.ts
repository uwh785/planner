import type { SqlDatabase } from '@/application/ports/SqlDatabase';

/**
 * One schema step. Never edit a shipped migration: add a new one with the
 * next number. SQLite runs one statement per call, so a migration is a list.
 */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

export class DatabaseNewerThanAppError extends Error {
  constructor(
    readonly databaseVersion: number,
    readonly appVersion: number,
  ) {
    super(
      `Database schema v${databaseVersion} is newer than this app knows (v${appVersion})`,
    );
    this.name = 'DatabaseNewerThanAppError';
  }
}

export async function getSchemaVersion(db: SqlDatabase): Promise<number> {
  const [row] = await db.query<{ user_version: number }>(
    'PRAGMA user_version',
  );
  return row?.user_version ?? 0;
}

/**
 * Applies pending migrations in order, each in its own transaction (the
 * version bump rolls back with it). Returns the resulting schema version.
 */
export async function runMigrations(
  db: SqlDatabase,
  migrations: readonly Migration[],
): Promise<number> {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(
        `Migrations must be numbered 1..n in order; got v${m.version} at position ${i + 1}`,
      );
    }
  });

  const known = migrations.length;
  const current = await getSchemaVersion(db);
  if (current > known) {
    throw new DatabaseNewerThanAppError(current, known);
  }

  for (const migration of migrations.slice(current)) {
    await db.transaction(async tx => {
      for (const statement of migration.statements) {
        await tx.execute(statement);
      }
      await tx.execute(`PRAGMA user_version = ${migration.version}`);
    });
  }
  return known;
}
