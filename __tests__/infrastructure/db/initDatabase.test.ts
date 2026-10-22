import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import { migrations } from '@/infrastructure/db/migrations';
import { initDatabase } from '@/infrastructure/db/initDatabase';
import { OpSqliteDatabase } from '@/infrastructure/db/OpSqliteDatabase';
import type { Migration } from '@/infrastructure/db/migrations/runner';

jest.mock('@/infrastructure/db/OpSqliteDatabase', () => ({
  OpSqliteDatabase: { open: jest.fn() },
}));

const open = OpSqliteDatabase.open as jest.Mock;

let db: NodeSqliteDatabase;
let closed: number;
beforeEach(() => {
  closed = 0;
  db = NodeSqliteDatabase.openInMemory();
  const realClose = db.close.bind(db);
  db.close = async () => {
    closed += 1;
    await realClose();
  };
  open.mockReset().mockReturnValue(db);
});

const good: Migration = {
  version: 1,
  name: 'a',
  statements: ['CREATE TABLE a (id INTEGER PRIMARY KEY)'],
};
const broken: Migration = {
  version: 2,
  name: 'broken',
  statements: ['INSERT INTO missing VALUES (1)'],
};

it('opens the named file, migrates and returns the open handle', async () => {
  const result = await initDatabase('planner_x.db', { migrations: [good] });
  expect(open).toHaveBeenCalledWith('planner_x.db');
  expect(result.schemaVersion).toBe(1);
  expect(result.db).toBe(db);
  expect(closed).toBe(0);
  await result.db.close();
});

it('closes the connection and rethrows when a migration fails', async () => {
  await expect(
    initDatabase('planner_x.db', { migrations: [good, broken] }),
  ).rejects.toThrow(/missing/);
  expect(closed).toBe(1);
});

it('still rethrows the migration error when closing also fails', async () => {
  const failing: SqlDatabase = db;
  failing.close = async () => {
    throw new Error('close failed');
  };
  await expect(
    initDatabase('planner_x.db', { migrations: [good, broken] }),
  ).rejects.toThrow(/missing/);
});

it('runs the shipped migrations by default (schema is current)', async () => {
  const result = await initDatabase('planner_x.db');
  expect(result.schemaVersion).toBe(migrations.length);
  await result.db.close();
});
