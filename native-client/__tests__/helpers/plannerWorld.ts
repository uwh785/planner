import type { AppContainer } from '@/application/container';
import {
  createPlanner,
  type Planner,
} from '@/application/planner/createPlanner';
import { FakeLifecycle, FakeTimer } from './syncFakes';
import { openTestWorld, type TestWorld } from './testRepositories';

export interface PlannerWorld extends TestWorld {
  planner: Planner;
  timer: FakeTimer;
  lifecycle: FakeLifecycle;
}

/** Real repositories over in-memory SQLite, wrapped in the planner services. */
export async function openPlannerWorld(): Promise<PlannerWorld> {
  const world = await openTestWorld();
  const timer = new FakeTimer(world.clock);
  const lifecycle = new FakeLifecycle(true);
  const planner = createPlanner(world, {
    clock: world.clock,
    timer,
    lifecycle,
  });
  return { ...world, planner, timer, lifecycle };
}

/** What the screens receive as the signed-in container. */
export function asContainer(world: TestWorld): AppContainer {
  return {
    ...world,
    schemaVersion: 2,
    close: () => world.db.close(),
  };
}

/** Lets pending promise callbacks run (live query refreshes, repo awaits). */
export const flushAsync = async (rounds = 5): Promise<void> => {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise(resolve => setImmediate(resolve));
  }
};
