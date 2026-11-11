import { initialSchema } from './001_initial_schema';
import { outboxOrigin } from './002_outbox_origin';
import { eventRemind } from './003_event_remind';
import type { Migration } from './runner';

/** Ordered, append-only. Never edit or reorder a shipped migration. */
export const migrations: readonly Migration[] = [
  initialSchema,
  outboxOrigin,
  eventRemind,
];
