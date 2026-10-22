export interface ApplyResult {
  /** Rows written (inserted, updated or tombstoned). */
  applied: number;
  /** Rows left alone because a local change is waiting in the outbox. */
  skippedPending: number;
  /** Malformed rows that were ignored. */
  invalid: number;
}

/** Applies a `GET /api/sync` response to the local database. */
export interface ApplyRemoteChanges {
  /**
   * All-or-nothing: either every valid row and the new cursor are stored, or
   * nothing is. Rows with a pending outbox entry are skipped (the local edit
   * wins until it is pushed; the next pull reconciles). Throws when `response`
   * is not an object.
   */
  applyRemoteChanges(response: unknown): Promise<ApplyResult>;
}
