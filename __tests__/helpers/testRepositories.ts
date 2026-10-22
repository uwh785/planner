import type { Clock } from '@/application/ports/Clock';
import type { IdGenerator, IdPrefix } from '@/application/ports/IdGenerator';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import { NodeSqliteDatabase } from '@/infrastructure/db/NodeSqliteDatabase';
import { migrations } from '@/infrastructure/db/migrations';
import { runMigrations } from '@/infrastructure/db/migrations/runner';
import {
  createRepositories,
  type Repositories,
} from '@/infrastructure/db/repositories/createRepositories';

/** Deterministic ids: `tsk_0000000000000001`, `chg_1`, ... */
export class SequentialIdGenerator implements IdGenerator {
  private n = 0;
  private c = 0;
  newId(prefix: IdPrefix): string {
    this.n += 1;
    return `${prefix}_${this.n.toString(16).padStart(16, '0')}`;
  }
  newChangeId(): string {
    this.c += 1;
    return `chg_${this.c}`;
  }
}

export class FakeClock implements Clock {
  constructor(public current = 1_000_000) {}
  now(): number {
    return this.current;
  }
  tick(ms = 1000): number {
    this.current += ms;
    return this.current;
  }
}

export interface TestWorld extends Repositories {
  db: SqlDatabase;
  clock: FakeClock;
  ids: SequentialIdGenerator;
}

export async function openTestWorld(): Promise<TestWorld> {
  const db = NodeSqliteDatabase.openInMemory();
  await runMigrations(db, migrations);
  const clock = new FakeClock();
  const ids = new SequentialIdGenerator();
  return { db, clock, ids, ...createRepositories(db, { ids, clock }) };
}

export interface OutboxRow {
  id: number;
  entity: string;
  op: string;
  entity_id: string;
  payload: string;
  change_id: string;
  origin: string;
  status: string;
  attempts: number;
  last_error: string | null;
}

export const outboxRows = (db: SqlDatabase) =>
  db.query<OutboxRow>('SELECT * FROM outbox ORDER BY id');

export const outboxSummary = async (db: SqlDatabase) =>
  (await outboxRows(db)).map(r => `${r.entity}:${r.op}:${r.entity_id}`);

export const rawRows = <T = Record<string, unknown>>(
  db: SqlDatabase,
  table: string,
) => db.query<T>(`SELECT * FROM ${table}`);

export const ID_SHAPE = /^(lst|tsk|sub|tag|cls|evt)_[0-9a-f]{16}$/;
