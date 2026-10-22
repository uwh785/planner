import type { SessionState } from '../auth/sessionState';
import type { AppContainer, ContainerSource } from '../container';
import type { AppLifecycle } from '../ports/AppLifecycle';
import type { Clock } from '../ports/Clock';
import type { Connectivity } from '../ports/Connectivity';
import type { HttpClient } from '../ports/HttpClient';
import type { Timer } from '../ports/Timer';
import { SyncEngine } from './SyncEngine';
import { SyncScheduler } from './SyncScheduler';
import {
  INITIAL_SYNC_SNAPSHOT,
  SyncStatus,
  type SyncSnapshot,
  type SyncStatusSource,
} from './SyncStatus';

/** What the coordinator needs to know about the session. */
export interface SessionStateSource {
  state(): SessionState;
  subscribe(listener: () => void): () => void;
}

export interface SyncCoordinatorDeps {
  session: SessionStateSource;
  /** The database of whoever is signed in. */
  containers: ContainerSource;
  /** Authenticated HTTP: adds the token and refreshes it on 401. */
  http: Pick<HttpClient, 'request'>;
  connectivity: Connectivity;
  lifecycle: AppLifecycle;
  timer: Timer;
  clock: Clock;
  random: () => number;
  log?: (message: string) => void;
}

interface Running {
  userId: string;
  scheduler: SyncScheduler;
  unwatch: () => void;
}

/**
 * Keeps exactly one engine and scheduler alive for the signed-in user: built
 * when the session becomes `signedIn` (which also syncs at once), stopped and
 * released on sign-out, expiry or a user switch, rebuilt for the next user.
 * It is also the status source the UI reads; it shows the idle default while
 * nobody is signed in.
 */
export class SyncCoordinator implements SyncStatusSource {
  private readonly view = new SyncStatus();
  private running: Running | null = null;
  private unsubscribe: (() => void) | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly deps: SyncCoordinatorDeps) {}

  getSnapshot = (): SyncSnapshot => this.view.getSnapshot();
  subscribe = (listener: () => void): (() => void) =>
    this.view.subscribe(listener);

  /** Begins following the session. Safe to call twice. */
  start(): void {
    if (this.unsubscribe !== null) {
      return;
    }
    this.unsubscribe = this.deps.session.subscribe(() => this.reconcile());
    this.reconcile();
  }

  /** Stops following the session and shuts the current user's sync down. */
  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.chain = this.chain.then(() => this.teardown());
    await this.chain;
  }

  /** Resolves once the pending start-up or shutdown work has settled. */
  idle(): Promise<void> {
    return this.chain;
  }

  private reconcile(): void {
    this.chain = this.chain.then(() => this.apply()).catch(() => undefined);
  }

  private wantedUser(): string | null {
    const state = this.deps.session.state();
    return state.status === 'signedIn' ? state.user.userId : null;
  }

  private async apply(): Promise<void> {
    const wanted = this.wantedUser();
    if (wanted === (this.running?.userId ?? null)) {
      return;
    }
    await this.teardown();
    if (wanted !== null) {
      await this.setup(wanted);
    }
  }

  private async setup(userId: string): Promise<void> {
    const { containers } = this.deps;
    let container: AppContainer;
    try {
      container = await containers.acquire();
    } catch {
      return; // signed out meanwhile, or the database would not open
    }
    if (this.wantedUser() !== userId || this.unsubscribe === null) {
      containers.release();
      return;
    }
    const engine = new SyncEngine({
      outbox: container.outbox,
      syncState: container.syncState,
      remoteChanges: container.remoteChanges,
      http: this.deps.http,
      clock: this.deps.clock,
      random: this.deps.random,
      log: this.deps.log,
    });
    const scheduler = new SyncScheduler({
      engine,
      changes: container.changes,
      connectivity: this.deps.connectivity,
      lifecycle: this.deps.lifecycle,
      timer: this.deps.timer,
      clock: this.deps.clock,
    });
    const unwatch = engine.status.subscribe(() =>
      this.view.set(engine.status.getSnapshot()),
    );
    this.running = { userId, scheduler, unwatch };
    this.view.set(engine.status.getSnapshot());
    scheduler.start();
  }

  private async teardown(): Promise<void> {
    const running = this.running;
    if (running === null) {
      return;
    }
    this.running = null;
    running.scheduler.stop();
    running.unwatch();
    this.view.set(INITIAL_SYNC_SNAPSHOT);
    this.deps.containers.release();
  }
}
