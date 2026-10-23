import { InvalidTransitionError } from '@/domain';
import type { Clock } from '../ports/Clock';
import type { TaskRepository } from '../ports/repositories';
import type { Notices } from './Notices';

/**
 * After a start or pause went through, further taps on the same task are
 * ignored for this long. A double tap on "Start" must not become "Start" then
 * an accidental "Pause" on the button that takes its place.
 */
export const TIMER_DEBOUNCE_MS = 800;

/**
 * `done`: written. `ignored`: a double tap (nothing happened). `refused`: the
 * task's status no longer allows it (for example a pull changed it). `gone`:
 * the task does not exist any more. `failed`: the write failed and the user
 * was told.
 */
export type TimerOutcome = 'done' | 'ignored' | 'refused' | 'gone' | 'failed';

export interface TaskTimerDeps {
  tasks: Pick<TaskRepository, 'start' | 'pause' | 'get'>;
  clock: Clock;
  notices: Pick<Notices, 'announce'>;
  debounceMs?: number;
}

/**
 * Start and pause as the screens use them. The moment of the tap is read
 * when the tap arrives, so the time the write takes is never credited, and
 * the backend later replays that same moment. Start and pause need no undo
 * window (unlike completion, which cannot be reversed), but they are guarded
 * against double taps: one write in flight per task, and a short quiet
 * period after a committed one.
 */
export class TaskTimerUseCases {
  private readonly busy = new Set<string>();
  private readonly lastDone = new Map<string, number>();

  constructor(private readonly deps: TaskTimerDeps) {}

  start(id: string): Promise<TimerOutcome> {
    return this.run(id, 'start');
  }

  pause(id: string): Promise<TimerOutcome> {
    return this.run(id, 'pause');
  }

  private async run(id: string, op: 'start' | 'pause'): Promise<TimerOutcome> {
    const { tasks, clock, notices } = this.deps;
    const at = clock.now();
    const last = this.lastDone.get(id);
    if (
      this.busy.has(id) ||
      (last !== undefined &&
        at - last < (this.deps.debounceMs ?? TIMER_DEBOUNCE_MS))
    ) {
      return 'ignored';
    }
    this.busy.add(id);
    try {
      const task = await tasks[op](id, at);
      if (task === null) {
        return 'gone';
      }
      this.lastDone.set(id, at);
      notices.announce({
        key: op === 'start' ? 'noticeStarted' : 'noticePaused',
        params: { title: task.title },
      });
      return 'done';
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        return 'refused';
      }
      notices.announce({
        key: 'noticeTimerFailed',
        params: { title: await this.titleOf(id) },
      });
      return 'failed';
    } finally {
      this.busy.delete(id);
    }
  }

  private async titleOf(id: string): Promise<string> {
    try {
      return (await this.deps.tasks.get(id))?.title ?? '';
    } catch {
      return '';
    }
  }
}
