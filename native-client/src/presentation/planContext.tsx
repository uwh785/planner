import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';
import type { PlanSource } from '@/application/plan/PlanService';
import type { PlanSummary } from '@/domain';

const PlanContext = createContext<PlanSource | null>(null);

export function PlanProvider({
  source,
  children,
}: {
  source: PlanSource | undefined;
  children: React.ReactNode;
}) {
  return (
    <PlanContext.Provider value={source ?? null}>
      {children}
    </PlanContext.Provider>
  );
}

/**
 * The signed-in user's plan (re-renders on change) and the page to upgrade,
 * refreshed once on mount. Null when no source is wired or nothing has been
 * read yet (offline on a first visit).
 */
export function usePlan(userId: string | null): {
  summary: PlanSummary | null;
  upgradeUrl: string;
} | null {
  const source = useContext(PlanContext);
  const subscribe = useCallback(
    (listener: () => void) =>
      source ? source.subscribe(listener) : () => undefined,
    [source],
  );
  const getSnapshot = useCallback(
    () => (source ? source.getSnapshot() : null),
    [source],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    if (source && userId !== null) {
      source.refresh(userId);
    }
  }, [source, userId]);
  if (!source || !snapshot || snapshot.userId !== userId) {
    return null;
  }
  return { summary: snapshot.summary, upgradeUrl: source.upgradeUrl };
}
