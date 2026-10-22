import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import { migrations } from '@/infrastructure/db/migrations';
import { runMigrations } from '@/infrastructure/db/migrations/runner';

const insert =
  'INSERT INTO outbox (entity, op, entity_id, payload, change_id, created_at) VALUES (?, ?, ?, ?, ?, ?)';

describe('migration 002 (outbox origin)', () => {
  let db: SqlDatabase;
  beforeEach(() => {
    db = NodeSqliteDatabase.openInMemory();
  });
  afterEach(() => db.close());

  it('is the second migration', () => {
    expect(migrations[1]).toMatchObject({ version: 2 });
  });

  it('adds an origin column that defaults to update', async () => {
    await runMigrations(db, migrations);
    await db.execute(insert, ['task', 'upsert', 't1', '{}', 'c1', 1]);
    const [row] = await db.query<{ origin: string }>(
      'SELECT origin FROM outbox',
    );
    expect(row!.origin).toBe('update');
  });

  it('upgrades a v1 database and keeps its queued entries', async () => {
    await runMigrations(db, migrations.slice(0, 1));
    await db.execute(insert, ['task', 'upsert', 't1', '{}', 'c1', 1]);
    expect(await runMigrations(db, migrations)).toBe(migrations.length);
    const rows = await db.query<{ entity_id: string; origin: string }>(
      'SELECT entity_id, origin FROM outbox',
    );
    expect(rows).toEqual([{ entity_id: 't1', origin: 'update' }]);
  });

  it('indexes the outbox by entity for coalescing and pull lookups', async () => {
    await runMigrations(db, migrations);
    const names = (
      await db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_outbox%'",
      )
    ).map(r => r.name);
    expect(names).toContain('idx_outbox_entity');
  });
});
