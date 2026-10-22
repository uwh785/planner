import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import {
  DatabaseNewerThanAppError,
  getSchemaVersion,
  runMigrations,
} from '@/infrastructure/db/migrations/runner';
import type { Migration } from '@/infrastructure/db/migrations/runner';
import { migrations } from '@/infrastructure/db/migrations';

const m1: Migration = {
  version: 1,
  name: 'create a',
  statements: ['CREATE TABLE a (id INTEGER PRIMARY KEY)'],
};
const m2: Migration = {
  version: 2,
  name: 'create b',
  statements: ['CREATE TABLE b (id INTEGER PRIMARY KEY)'],
};

const tables = async (db: SqlDatabase) =>
  (
    await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
  ).map(r => r.name);

describe('runMigrations', () => {
  let db: SqlDatabase;
  beforeEach(() => {
    db = NodeSqliteDatabase.openInMemory();
  });
  afterEach(() => db.close());

  it('applies every migration to a fresh database', async () => {
    expect(await getSchemaVersion(db)).toBe(0);
    expect(await runMigrations(db, [m1, m2])).toBe(2);
    expect(await getSchemaVersion(db)).toBe(2);
    expect(await tables(db)).toEqual(['a', 'b']);
  });

  it('is a no-op when run again', async () => {
    await runMigrations(db, [m1, m2]);
    expect(await runMigrations(db, [m1, m2])).toBe(2);
    expect(await tables(db)).toEqual(['a', 'b']);
  });

  it('resumes a partially migrated database', async () => {
    await runMigrations(db, [m1]);
    await db.execute('INSERT INTO a VALUES (1)');
    expect(await runMigrations(db, [m1, m2])).toBe(2);
    expect(await db.query('SELECT id FROM a')).toEqual([{ id: 1 }]);
    expect(await tables(db)).toEqual(['a', 'b']);
  });

  it('refuses a database newer than the app knows', async () => {
    await runMigrations(db, [m1, m2]);
    await expect(runMigrations(db, [m1])).rejects.toBeInstanceOf(
      DatabaseNewerThanAppError,
    );
    expect(await getSchemaVersion(db)).toBe(2);
  });

  it('rolls back a failed migration and keeps earlier ones', async () => {
    const broken: Migration = {
      version: 2,
      name: 'broken',
      statements: [
        'CREATE TABLE b (id INTEGER PRIMARY KEY)',
        'INSERT INTO missing VALUES (1)',
      ],
    };
    await expect(runMigrations(db, [m1, broken])).rejects.toBeDefined();
    expect(await getSchemaVersion(db)).toBe(1);
    expect(await tables(db)).toEqual(['a']);
    expect(await runMigrations(db, [m1, m2])).toBe(2);
  });

  it('rejects a migration list that is not numbered 1..n in order', async () => {
    await expect(runMigrations(db, [m2])).rejects.toThrow(/numbered/);
    await expect(runMigrations(db, [m1, m1])).rejects.toThrow(/numbered/);
  });
});

describe('shipped migrations', () => {
  it('are numbered consecutively from 1', () => {
    expect(migrations.map(m => m.version)).toEqual(
      migrations.map((_, i) => i + 1),
    );
  });
});
