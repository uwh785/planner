import type { AppLifecycle } from '../ports/AppLifecycle';
import type { Clock } from '../ports/Clock';
import type { TaskRepository } from '../ports/repositories';
import type { Timer } from '../ports/Timer';
import type { Notices } from './Notices';

/** How long "Undo" stays available after ticking a task. */
export const COMPLETION_WINDOW_MS = 5_000;

interface Entry {
  title: string;
  /** When the user ticked it: the moment the server will be told. */
  at: number;
  cancelTimer: (() => void) | null;
  /** Set once the write has started; the entry can no longer be undone. */
  saving: Promise<void> | null;
}

export interface CompletionDeps {
  tasks: Pick<TaskRepository, 'complete'>;
  timer: Timer;
  clock: Clock;
  notices?: Pick<Notices, 'announce'>;
  /** Stops listening here when the app leaves the foreground. */
  lifecycle?: AppLifecycle;
  /**
   * Resolves once the screens have re-read after a completion, so a row never
   * flashes back to "open" between the write and the refresh.
   */
  settled?: () => Promise<void>;
  windowMs?: number;
}

/**
 * The undo window for completing a task.
 *
 * The backend has no way to reopen a task, so completion is final once it is
 * written and pushed. Ticking a task therefore only starts a short window
 * (about five seconds) in which the row shows as completing with an Undo
 * action; nothing is written, so nothing can reach the outbox. When the
 * window elapses the task is completed through the repository, stamped with
 * the moment of the tick.
 *
 * Windows still open are completed (not dropped) by `flush()`, which the
 * app calls when a screen goes away, when the app leaves the foreground and
 * before signing out. A process kill inside the window loses the tick; that
 * is the accepted cost of the window.
 */
export class CompletionWindow {
  private readonly entries = new Map<string, Entry>();
  private snapshot: ReadonlySet<string> = new Set();
  private readonly listeners = new Set<() => void>();
  private readonly stopLifecycle: (() => void) | null;

  constructor(private readonly deps: CompletionDeps) {
    this.stopLifecycle =
      deps.lifecycle?.subscribe(foreground => {
        if (!foreground) {
          this.flush();
        }
      }) ?? null;
  }

  /** Ids of the tasks that are completing now. A new object on every change. */
  getSnapshot = (): ReadonlySet<string> => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  has(id: string): boolean {
    return this.entries.has(id);
  }

  begin(task: { id: string; title: string }): void {
    if (this.entries.has(task.id)) {
      return;
    }
    const entry: Entry = {
      title: task.title,
      at: this.deps.clock.now(),
      cancelTimer: null,
      saving: null,
    };
    entry.cancelTimer = this.deps.timer.schedule(() => {
      this.commit(task.id);
    }, this.deps.windowMs ?? COMPLETION_WINDOW_MS);
    this.entries.set(task.id, entry);
    this.publish();
    this.deps.notices?.announce({
      key: 'noticeCompleting',
      params: { title: task.title },
    });
  }

  undo(id: string): void {
    const entry = this.entries.get(id);
    if (entry === undefined || entry.saving !== null) {
      return;
    }
    entry.cancelTimer?.();
    this.entries.delete(id);
    this.publish();
    this.deps.notices?.announce({
      key: 'noticeReopened',
      params: { title: entry.title },
    });
  }

  /** Completes every task still in its window, now. Never rejects. */
  async flush(): Promise<void> {
    await Promise.all([...this.entries.keys()].map(id => this.commit(id)));
  }

  /** Forgets the open windows without writing (the database is going away). */
  dispose(): void {
    this.stopLifecycle?.();
    this.entries.forEach(entry => entry.cancelTimer?.());
    this.entries.clear();
    this.publish();
  }

  private commit(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (entry === undefined) {
      return Promise.resolve();
    }
    if (entry.saving === null) {
      entry.cancelTimer?.();
      entry.cancelTimer = null;
      entry.saving = this.save(id, entry);
    }
    return entry.saving;
  }

  private async save(id: string, entry: Entry): Promise<void> {
    try {
      await this.deps.tasks.complete(id, entry.at);
      await this.deps.settled?.();
    } catch {
      this.deps.notices?.announce({
        key: 'noticeCompleteFailed',
        params: { title: entry.title },
      });
    } finally {
      if (this.entries.get(id) === entry) {
        this.entries.delete(id);
        this.publish();
      }
    }
  }

  private publish(): void {
    this.snapshot = new Set(this.entries.keys());
    [...this.listeners].forEach(listener => listener());
  }
}
