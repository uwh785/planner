import type { Clock } from '@/application/ports/Clock';
import type { IdGenerator } from '@/application/ports/IdGenerator';
import type { SqlDatabase } from '@/application/ports/SqlDatabase';
import type { OutboxWriter } from './OutboxWriter';

export interface RepoDeps {
  db: SqlDatabase;
  ids: IdGenerator;
  clock: Clock;
  outbox: OutboxWriter;
}
