import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Planner } from '@/application/planner/createPlanner';
import type { LiveQuery, LiveState } from '@/application/planner/LiveQuery';
import type { Notice } from '@/application/planner/Notices';

const PlannerContext = createContext<Planner | null>(null);

export const PlannerProvider = PlannerContext.Provider;

/** The lists and tasks services of the signed-in user. */
export function usePlanner(): Planner {
  const planner = useContext(PlannerContext);
  if (planner === null) {
    throw new Error('usePlanner needs a PlannerProvider');
  }
  return planner;
}

/**
 * Follows a live query (it reruns when local data changes). `make` runs once
 * per `deps` change; build the query from `planner.queries`.
 */
export function useLiveQuery<T>(
  make: (planner: Planner) => LiveQuery<T>,
  deps: readonly unknown[],
  /** Also rerun this often, for results that age with the clock. */
  refreshMs?: number,
): LiveState<T> {
  const planner = usePlanner();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const query = useMemo(() => make(planner), [planner, ...deps]);
  useEffect(() => {
    if (refreshMs === undefined) {
      return undefined;
    }
    let cancel = () => {};
    const tick = () => {
      query.reload();
      cancel = planner.schedule(tick, refreshMs);
    };
    cancel = planner.schedule(tick, refreshMs);
    return () => cancel();
  }, [planner, query, refreshMs]);
  return useSyncExternalStore(query.subscribe, query.getSnapshot);
}

/**
 * The current time, refreshed every `intervalMs` on the planner's timer.
 * `null` stops the refreshing (nothing on screen is running): the time is
 * read once when the interval changes and then holds still.
 */
export function useNow(intervalMs: number | null): number {
  const planner = usePlanner();
  const [now, setNow] = useState(() => planner.now());
  useEffect(() => {
    setNow(planner.now());
    if (intervalMs === null) {
      return undefined;
    }
    let cancel = () => {};
    const tick = () => {
      setNow(planner.now());
      cancel = planner.schedule(tick, intervalMs);
    };
    cancel = planner.schedule(tick, intervalMs);
    return () => cancel();
  }, [planner, intervalMs]);
  return now;
}

/** Ids of the tasks that are in their undo window. */
export function useCompleting(): ReadonlySet<string> {
  const { completion } = usePlanner();
  return useSyncExternalStore(completion.subscribe, completion.getSnapshot);
}

/** The latest short message to say out loud, or null. */
export function useNotice(): Notice | null {
  const { notices } = usePlanner();
  return useSyncExternalStore(notices.subscribe, notices.getSnapshot);
}
