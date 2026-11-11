import type { SyncMeta } from './syncMeta';

export interface Event extends SyncMeta {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: number;
  endAt: number | null;
  allDay: boolean;
  /** Show on the home panel with a days-left countdown. */
  remind: boolean;
  color: string;
}
