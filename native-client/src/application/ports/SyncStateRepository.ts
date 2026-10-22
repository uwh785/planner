export interface SyncStateRepository {
  /** The `since` value for the next pull; 0 before the first sync. */
  getCursor(): Promise<number>;
  setCursor(cursor: number): Promise<void>;
  /** Epoch ms of the last successful sync, or null when never synced. */
  getLastSyncAt(): Promise<number | null>;
  setLastSyncAt(at: number): Promise<void>;
}
