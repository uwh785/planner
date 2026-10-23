import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { Planner } from '@/application/planner/createPlanner';
import type { LiveQuery, LiveState } from '@/application/planner/LiveQuery';
import type { Notice } from '@/application/planner/Notices';
import { NotFoundError, ValidationError } from '@/domain';

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
): LiveState<T> {
  const planner = usePlanner();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const query = useMemo(() => make(planner), [planner, ...deps]);
  return useSyncExternalStore(query.subscribe, query.getSnapshot);
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

/** Maps an error from a use case to one short sentence for the screen. */
export function errorSentence(error: unknown): string {
  const raw =
    error instanceof ValidationError || error instanceof NotFoundError
      ? error.message
      : "Couldn't save. Try again.";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
