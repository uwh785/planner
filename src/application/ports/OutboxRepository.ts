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

/**
 * `pending`: waiting to be pushed. `blocked`: the server cannot take it until
 * something changes (plan limit, storage ceiling, a parent that never
 * arrived). `rejected`: the server refused it for good (invalid, or the id is
 * taken). Parked entries are never pushed automatically; the local row stays.
 */
export type OutboxStatus = 'pending' | 'blocked' | 'rejected';

export type ParkedStatus = Exclude<OutboxStatus, 'pending'>;

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
  status: OutboxStatus;
  createdAt: number;
  attempts: number;
  lastError: string | null;
}

/**
 * Read and acknowledge side of the outbox. Entries are only ever added by the
 * repositories' own mutations, inside the same transaction as the data change.
 *
 * Parked entries and later edits: a local edit (or a re-added link) of an
 * entity whose upsert is parked revives that same entry (back to `pending`,
 * attempts reset, new payload, same id and change id), so the user's fix gets
 * a fresh try and no second entry for the entity ever exists. Deleting such an
 * entity drops a parked `create` outright (the server never had it) and
 * replaces a parked update by one pending delete.
 */
export interface OutboxRepository {
  /** Pending entries only, oldest first. */
  peekPending(limit: number): Promise<OutboxEntry[]>;
  /** The server accepted these entries; they leave the queue. */
  markSent(ids: readonly number[]): Promise<void>;
  /** Keeps the entry pending, counting the attempt and remembering why. */
  recordAttempt(id: number, error: string): Promise<void>;
  /** Stops pushing the entry until `retryParked`; remembers the server message. */
  park(id: number, status: ParkedStatus, error: string): Promise<void>;
  pendingCount(): Promise<number>;
  countByStatus(): Promise<Record<OutboxStatus, number>>;
  /** Blocked and rejected entries, oldest first (for a future attention list). */
  listParked(): Promise<OutboxEntry[]>;
  /**
   * Moves parked entries (all, or the given ids) back to pending with their
   * attempts reset. Returns how many were moved.
   */
  retryParked(ids?: readonly number[]): Promise<number>;
  /** Pending entries of one entity kind. */
  pendingByEntity(entity: OutboxEntity): Promise<OutboxEntry[]>;
}
