import type { SyncMeta } from './syncMeta';

/** A weekly recurring class. `dayOfWeek` is 0-6; minutes count from midnight. */
export interface ClassSession extends SyncMeta {
  id: string;
  subject: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  room: string;
  teacher: string;
  color: string;
}
