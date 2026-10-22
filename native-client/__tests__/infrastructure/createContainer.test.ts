import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import { migrations } from '@/infrastructure/db/migrations';
import { runMigrations } from '@/infrastructure/db/migrations/runner';
import {
  buildContainer,
  createContainer,
} from '@/infrastructure/composition/createContainer';
import { initDatabase } from '@/infrastructure/db/initDatabase';
import { FakeClock, SequentialIdGenerator } from '../helpers/testRepositories';

jest.mock('@/infrastructure/db/initDatabase', () => ({
  initDatabase: jest.fn(),
}));

const init = initDatabase as jest.Mock;

it('builds every repository over the given database', async () => {
  const db = NodeSqliteDatabase.openInMemory();
  await runMigrations(db, migrations);
  const container = buildContainer(db, migrations.length, {
    ids: new SequentialIdGenerator(),
    clock: new FakeClock(),
  });
  const task = await container.tasks.create({ title: 'wired' });
  expect(await container.tasks.get(task.id)).toMatchObject({ title: 'wired' });
  expect(await container.outbox.pendingCount()).toBe(1);
  expect(await container.syncState.getCursor()).toBe(0);
  expect(container.schemaVersion).toBe(migrations.length);
  await container.close();
});

it('opens the per-user database file and exposes its schema version', async () => {
  const db = NodeSqliteDatabase.openInMemory();
  await runMigrations(db, migrations);
  init.mockResolvedValue({ db, schemaVersion: 2 });
  const container = await createContainer({ userId: 'usr_1' });
  expect(init).toHaveBeenCalledWith('planner_usr_1.db');
  expect(container.schemaVersion).toBe(2);
  await container.close();
});

it('refuses an unsafe user id before touching the database', async () => {
  init.mockClear();
  await expect(createContainer({ userId: '../x' })).rejects.toThrow(
    /unsafe user id/i,
  );
  expect(init).not.toHaveBeenCalled();
});

it('closes the database through the container', async () => {
  const db = NodeSqliteDatabase.openInMemory();
  await runMigrations(db, migrations);
  const container = buildContainer(db, 1);
  await container.close();
  await expect(db.query('SELECT 1')).rejects.toBeDefined();
});
