import type { SyncMeta } from './syncMeta';

export interface Event extends SyncMeta {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: number;
  endAt: number | null;
  allDay: boolean;
  color: string;
}
