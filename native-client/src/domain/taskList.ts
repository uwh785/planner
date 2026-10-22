import type { SyncMeta } from './syncMeta';

export interface TaskList extends SyncMeta {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
}
