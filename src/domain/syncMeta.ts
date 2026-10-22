/**
 * Change-tracking fields every synced entity carries. `updatedAt` is epoch
 * milliseconds (0 = never stamped); `deleted` marks a tombstone that is kept
 * so the deletion can reach the server and other devices.
 */
export interface SyncMeta {
  updatedAt: number;
  deleted: boolean;
}
