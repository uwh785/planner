import type { Migration } from './runner';

/**
 * Lets the outbox tell an entity created on this device and never pushed
 * (`create`) from one the server already knows (`update`, the default for
 * entries queued before this migration). Deleting the first needs no push at
 * all. Also indexes entries by entity for coalescing and for pull, which
 * must not overwrite rows that have a pending change.
 */
export const outboxOrigin: Migration = {
  version: 2,
  name: 'outbox origin',
  statements: [
    "ALTER TABLE outbox ADD COLUMN origin TEXT NOT NULL DEFAULT 'update'",
    'CREATE INDEX idx_outbox_entity ON outbox(entity, entity_id)',
  ],
};
