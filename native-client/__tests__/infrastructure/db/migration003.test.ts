import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import { migrations } from '@/infrastructure/db/migrations';
import { runMigrations } from '@/infrastructure/db/migrations/runner';

const insert =
  'INSERT INTO events (event_id, title, start_at) VALUES (?, ?, ?)';

describe('migration 003 (event remind)', () => {
  let db: SqlDatabase;
  beforeEach(() => {
    db = NodeSqliteDatabase.openInMemory();
  });
  afterEach(() => db.close());

  it('is the third migration', () => {
    expect(migrations[2]).toMatchObject({ version: 3 });
  });

  it('adds a remind column that defaults to off', async () => {
    await runMigrations(db, migrations);
    await db.execute(insert, ['e1', 'Dentist', 1000]);
    const [row] = await db.query<{ remind: number }>(
      'SELECT remind FROM events',
    );
    expect(row!.remind).toBe(0);
  });

  it('upgrades a v2 database and keeps its events, not flagged', async () => {
    await runMigrations(db, migrations.slice(0, 2));
    await db.execute(insert, ['e1', 'Dentist', 1000]);
    expect(await runMigrations(db, migrations)).toBe(migrations.length);
    const rows = await db.query<{ event_id: string; remind: number }>(
      'SELECT event_id, remind FROM events',
    );
    expect(rows).toEqual([{ event_id: 'e1', remind: 0 }]);
  });
});
