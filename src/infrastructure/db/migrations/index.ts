import { initialSchema } from './001_initial_schema';
import type { Migration } from './runner';

/** Ordered, append-only. Never edit or reorder a shipped migration. */
export const migrations: readonly Migration[] = [initialSchema];
