import type { SyncMeta } from './syncMeta';

export interface Tag extends SyncMeta {
  id: string;
  name: string;
  color: string;
}

/** Link between a task and a tag; identified by the pair, not by an id. */
export interface TaskTag extends SyncMeta {
  taskId: string;
  tagId: string;
}
