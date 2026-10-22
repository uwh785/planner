import React, {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from 'react';
import type {
  SyncSnapshot,
  SyncStatusSource,
} from '@/application/sync/SyncStatus';

const SyncContext = createContext<SyncStatusSource | null>(null);

export function SyncProvider({
  source,
  children,
}: {
  source: SyncStatusSource | undefined;
  children: React.ReactNode;
}) {
  return (
    <SyncContext.Provider value={source ?? null}>
      {children}
    </SyncContext.Provider>
  );
}

/** The current sync status (re-renders on change), or null when none is wired. */
export function useSyncStatus(): SyncSnapshot | null {
  const source = useContext(SyncContext);
  const subscribe = useCallback(
    (listener: () => void) =>
      source ? source.subscribe(listener) : () => undefined,
    [source],
  );
  const getSnapshot = useCallback(
    () => (source ? source.getSnapshot() : null),
    [source],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}
