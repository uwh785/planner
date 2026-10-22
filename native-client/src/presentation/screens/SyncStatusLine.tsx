import React, { useEffect, useReducer } from 'react';
import { StatusLine } from '../components/molecules/StatusLine';
import { useSyncStatus } from '../syncContext';
import { syncStatusText } from '../syncStatusText';

/** How often "Synced 5 min ago" is recomputed. */
const REFRESH_MS = 30_000;

/** Container: reads the sync status and shows its one-line summary. */
export function SyncStatusLine() {
  const snapshot = useSyncStatus();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const aging = snapshot?.phase === 'idle' && snapshot.lastSyncAt !== null;

  useEffect(() => {
    if (!aging) {
      return undefined;
    }
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [aging]);

  return snapshot === null ? null : (
    <StatusLine text={syncStatusText(snapshot, Date.now())} />
  );
}
