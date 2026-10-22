import type { SyncMeta } from './syncMeta';

export interface Subtask extends SyncMeta {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
}
