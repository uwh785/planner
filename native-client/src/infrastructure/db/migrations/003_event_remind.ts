import type { Migration } from './runner';

/**
 * Lets an event be flagged as a reminder: the home panel lists it with the
 * days left until its start. Events stored before this migration are not
 * flagged.
 */
export const eventRemind: Migration = {
  version: 3,
  name: 'event remind',
  statements: [
    'ALTER TABLE events ADD COLUMN remind INTEGER NOT NULL DEFAULT 0',
  ],
};
