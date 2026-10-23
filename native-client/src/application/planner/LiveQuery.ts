import type { ChangeSource } from '../ports/ChangeNotifier';

/** What `settled()` needs from a query, whatever it returns. */
export interface Idleable {
  idle(): Promise<void>;
}

export type LiveState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  /** A rerun failed; `data` is the last good result, if any. */
  | { status: 'error'; data?: T };

/**
 * A query that stays current. It loads on the first subscriber, reruns after
 * every change the source reports (one run at a time; a burst of changes
 * costs one follow-up run) and stops listening with the last subscriber.
 * The snapshot object only changes when the state does, so it fits
 * `useSyncExternalStore` directly.
 */
export class LiveQuery<T> {
  private state: LiveState<T> = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private stopWatching: (() => void) | null = null;
  private running: Promise<void> | null = null;
  private dirty = false;

  constructor(
    private readonly fetch: () => Promise<T>,
    private readonly source: ChangeSource,
    private readonly hooks: {
      onActive?: (query: Idleable) => void;
      onInactive?: (query: Idleable) => void;
    } = {},
  ) {}

  getSnapshot = (): LiveState<T> => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.stopWatching = this.source.subscribe(() => this.refresh());
      this.hooks.onActive?.(this);
      this.refresh();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopWatching?.();
        this.stopWatching = null;
        this.hooks.onInactive?.(this);
      }
    };
  };

  /** Resolves when no run is in flight and none is waiting. */
  idle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  private refresh(): void {
    if (this.listeners.size === 0) {
      return;
    }
    if (this.running !== null) {
      this.dirty = true;
      return;
    }
    this.running = this.loop();
  }

  private async loop(): Promise<void> {
    do {
      this.dirty = false;
      try {
        this.set({ status: 'ready', data: await this.fetch() });
      } catch {
        const last = this.state.status === 'loading' ? undefined : this.state.data;
        this.set(last === undefined ? { status: 'error' } : { status: 'error', data: last });
      }
    } while (this.dirty && this.listeners.size > 0);
    this.running = null;
  }

  private set(next: LiveState<T>): void {
    this.state = next;
    [...this.listeners].forEach(listener => listener());
  }
}
