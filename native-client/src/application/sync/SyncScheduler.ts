import type { AppLifecycle } from '../ports/AppLifecycle';
import type { ChangeSource } from '../ports/ChangeNotifier';
import type { Clock } from '../ports/Clock';
import type { Connectivity } from '../ports/Connectivity';
import type { Timer } from '../ports/Timer';
import type { SyncEngine } from './SyncEngine';

/** The slice of the engine the scheduler drives. */
export type SchedulableEngine = Pick<
  SyncEngine,
  'sync' | 'refresh' | 'noteConnectivity' | 'status' | 'nextRetryAt'
>;

export interface SyncSchedulerDeps {
  engine: SchedulableEngine;
  changes: ChangeSource;
  connectivity: Connectivity;
  lifecycle: AppLifecycle;
  timer: Timer;
  clock: Clock;
  /** Quiet time after the last local change before syncing. Default 2 s. */
  debounceMs?: number;
  /** Interval of the foreground timer. Default 5 min. */
  periodicMs?: number;
}

/** The engine reports its own failures through its status; nothing to add. */
const ignore = (): void => undefined;

export const DEFAULT_DEBOUNCE_MS = 2_000;
export const DEFAULT_PERIODIC_MS = 5 * 60_000;

/**
 * Decides when the engine runs: right after start, when the network comes
 * back, when the app returns to the foreground, a moment after a local
 * change, every few minutes while on screen, and when a failed run's
 * `nextRetryAt` arrives. It never runs the engine while the OS is offline or
 * the session is gone (`paused`), and `stop()` releases every timer and
 * listener. One instance serves one signed-in user.
 */
export class SyncScheduler {
  private readonly debounceMs: number;
  private readonly periodicMs: number;
  private cleanups: (() => void)[] = [];
  private started = false;
  private online = true;
  private cancelDebounce: (() => void) | null = null;
  private cancelPeriodic: (() => void) | null = null;
  private cancelRetry: (() => void) | null = null;
  private scheduledRetryAt: number | null = null;

  constructor(private readonly deps: SyncSchedulerDeps) {
    this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.periodicMs = deps.periodicMs ?? DEFAULT_PERIODIC_MS;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const { engine, changes, connectivity, lifecycle } = this.deps;
    this.online = connectivity.isOnline();
    this.cleanups.push(
      changes.subscribe(() => this.onLocalChange()),
      connectivity.subscribe(online => this.onConnectivity(online)),
      lifecycle.subscribe(foreground => this.onLifecycle(foreground)),
      engine.status.subscribe(() => this.followRetryTime()),
    );
    engine.noteConnectivity(this.online);
    engine.refresh().catch(ignore);
    if (lifecycle.isForeground()) {
      this.schedulePeriodic();
    }
    this.run();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
    this.cancelDebounce?.();
    this.cancelPeriodic?.();
    this.cancelRetry?.();
    this.cancelDebounce = this.cancelPeriodic = this.cancelRetry = null;
    this.scheduledRetryAt = null;
  }

  private run(): void {
    if (
      !this.started ||
      !this.online ||
      this.deps.engine.status.getSnapshot().phase === 'paused'
    ) {
      return;
    }
    this.deps.engine.sync().catch(ignore);
  }

  private onConnectivity(online: boolean): void {
    const regained = online && !this.online;
    this.online = online;
    this.deps.engine.noteConnectivity(online);
    if (regained) {
      this.run();
    }
  }

  private onLifecycle(foreground: boolean): void {
    this.cancelPeriodic?.();
    this.cancelPeriodic = null;
    if (foreground) {
      this.schedulePeriodic();
      this.run();
    }
  }

  private onLocalChange(): void {
    this.deps.engine.refresh().catch(ignore);
    this.cancelDebounce?.();
    this.cancelDebounce = this.deps.timer.schedule(() => {
      this.cancelDebounce = null;
      this.run();
    }, this.debounceMs);
  }

  private schedulePeriodic(): void {
    this.cancelPeriodic = this.deps.timer.schedule(() => {
      this.cancelPeriodic = null;
      if (this.deps.lifecycle.isForeground()) {
        this.schedulePeriodic();
      }
      this.run();
    }, this.periodicMs);
  }

  /** Keeps one timer on the engine's current `nextRetryAt`. */
  private followRetryTime(): void {
    const { engine, timer, clock } = this.deps;
    const at = engine.nextRetryAt;
    if (at === this.scheduledRetryAt) {
      return;
    }
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.scheduledRetryAt = at;
    if (at !== null) {
      this.cancelRetry = timer.schedule(() => {
        this.cancelRetry = null;
        this.scheduledRetryAt = null;
        this.run();
      }, Math.max(0, at - clock.now()));
    }
  }
}
