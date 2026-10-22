/**
 * - `idle`: nothing running; `syncing`: a run is in flight;
 * - `offline`: the server could not be reached (or the OS says offline);
 * - `error`: the server answered with a failure; a retry is scheduled;
 * - `paused`: the session is gone; syncing resumes after signing in again.
 */
export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error' | 'paused';

export interface SyncSnapshot {
  phase: SyncPhase;
  /** Changes waiting to be pushed. */
  pendingCount: number;
  /** Parked: the server cannot take them yet (limits, missing parent). */
  blockedCount: number;
  /** Parked: the server refused them for good. */
  rejectedCount: number;
  /** Epoch ms of the last fully clean sync, or null. */
  lastSyncAt: number | null;
  /** Message of the last failure, never a payload; null after a clean run. */
  lastError: string | null;
  /** Epoch ms of the next automatic retry, or null. */
  nextRetryAt: number | null;
}

/** What the UI reads; the same shape works for useSyncExternalStore. */
export interface SyncStatusSource {
  getSnapshot(): SyncSnapshot;
  subscribe(listener: () => void): () => void;
}

export const INITIAL_SYNC_SNAPSHOT: SyncSnapshot = {
  phase: 'idle',
  pendingCount: 0,
  blockedCount: 0,
  rejectedCount: 0,
  lastSyncAt: null,
  lastError: null,
  nextRetryAt: null,
};

const same = (a: SyncSnapshot, b: SyncSnapshot): boolean =>
  (Object.keys(a) as (keyof SyncSnapshot)[]).every(key => a[key] === b[key]);

/**
 * Observable, immutable snapshot of the sync state. The snapshot object only
 * changes when a field does, so subscribers are not woken for nothing.
 */
export class SyncStatus implements SyncStatusSource {
  private snapshot: SyncSnapshot = INITIAL_SYNC_SNAPSHOT;
  private readonly listeners = new Set<() => void>();

  getSnapshot = (): SyncSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  update(patch: Partial<SyncSnapshot>): void {
    this.set({ ...this.snapshot, ...patch });
  }

  set(next: SyncSnapshot): void {
    if (same(this.snapshot, next)) {
      return;
    }
    this.snapshot = next;
    this.listeners.forEach(listener => listener());
  }
}
