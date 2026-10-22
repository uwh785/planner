/** Entity names of the push API. */
export type OutboxEntity =
  | 'list'
  | 'task'
  | 'subtask'
  | 'tag'
  | 'task_tag'
  | 'class'
  | 'event';

/** Timer ops (start, pause, complete) arrive with M6. */
export type OutboxOp = 'upsert' | 'delete';

/**
 * `create`: the entity was made on this device and the server has not seen
 * it yet, so deleting it before a push cancels everything. `update`: the
 * server knows the entity (or may know it).
 */
export type OutboxOrigin = 'create' | 'update';

export interface OutboxEntry {
  /** Ordering key: ascending id is dependency-safe creation order. */
  id: number;
  entity: OutboxEntity;
  op: OutboxOp;
  /** `task_tag` uses `<task_id>:<tag_id>`, see taskTagEntityId. */
  entityId: string;
  /** The JSON `data` of the push change, snake_case. */
  payload: Record<string, unknown>;
  changeId: string;
  origin: OutboxOrigin;
  createdAt: number;
  attempts: number;
  lastError: string | null;
}

/**
 * Read and acknowledge side of the outbox. Entries are only ever added by the
 * repositories' own mutations, inside the same transaction as the data change.
 */
export interface OutboxRepository {
  /** Oldest first. */
  peekPending(limit: number): Promise<OutboxEntry[]>;
  /** The server accepted these entries; they leave the queue. */
  markSent(ids: readonly number[]): Promise<void>;
  /** Keeps the entry queued, counting the attempt and remembering why. */
  markFailed(id: number, error: string): Promise<void>;
  pendingCount(): Promise<number>;
  /** Pending entries of one entity kind, used by pull to protect local edits. */
  pendingByEntity(entity: OutboxEntity): Promise<OutboxEntry[]>;
}
