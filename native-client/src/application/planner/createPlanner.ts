import type { AppContainer } from '../container';
import type { AppLifecycle } from '../ports/AppLifecycle';
import type { Clock } from '../ports/Clock';
import type { Timer } from '../ports/Timer';
import { CompletionWindow } from './CompletionWindow';
import { ClassUseCases } from '../schedule/ClassUseCases';
import { ListUseCases } from './ListUseCases';
import { Notices } from './Notices';
import { PlannerQueries } from './PlannerQueries';
import { SubtaskUseCases } from './SubtaskUseCases';
import { TaskTimerUseCases } from './TaskTimerUseCases';
import { TaskUseCases } from './TaskUseCases';

/** The platform bits the planner needs, injected so tests control them. */
export interface PlannerRuntime {
  clock: Clock;
  timer: Timer;
  /** When present, open completion windows are flushed on background. */
  lifecycle?: AppLifecycle;
}

/** Everything the lists and tasks screens use, for one signed-in container. */
export interface Planner {
  queries: PlannerQueries;
  lists: ListUseCases;
  tasks: TaskUseCases;
  /** Start and pause (completion has its own undo window, `completion`). */
  taskTimer: TaskTimerUseCases;
  subtasks: SubtaskUseCases;
  /** Create, edit and delete weekly classes. */
  classes: ClassUseCases;
  completion: CompletionWindow;
  notices: Notices;
  /** The current time, from the same clock the services use. */
  now(): number;
  /** Runs `fn` once after `delayMs` on the shared timer; returns its cancel. */
  schedule(fn: () => void, delayMs: number): () => void;
  /** Drops timers and listeners. Flush `completion` first to keep its ticks. */
  dispose(): void;
}

export type PlannerSource = Pick<
  AppContainer,
  'taskLists' | 'tasks' | 'subtasks' | 'classSessions' | 'dataChanges'
>;

export function createPlanner(
  source: PlannerSource,
  runtime: PlannerRuntime,
): Planner {
  const notices = new Notices(runtime.timer);
  const queries = new PlannerQueries({ ...source, clock: runtime.clock });
  const completion = new CompletionWindow({
    tasks: source.tasks,
    timer: runtime.timer,
    clock: runtime.clock,
    notices,
    lifecycle: runtime.lifecycle,
    settled: () => queries.settled(),
  });
  return {
    queries,
    lists: new ListUseCases(source.taskLists, notices),
    tasks: new TaskUseCases(source.tasks, source.taskLists, notices),
    taskTimer: new TaskTimerUseCases({
      tasks: source.tasks,
      clock: runtime.clock,
      notices,
    }),
    subtasks: new SubtaskUseCases(source.subtasks, source.tasks, notices),
    classes: new ClassUseCases(source.classSessions, notices),
    completion,
    notices,
    now: () => runtime.clock.now(),
    schedule: (fn, delayMs) => runtime.timer.schedule(fn, delayMs),
    dispose: () => {
      completion.dispose();
      notices.dispose();
    },
  };
}
