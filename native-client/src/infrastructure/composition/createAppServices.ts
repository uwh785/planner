import { AuthenticatedHttp } from '@/application/auth/AuthenticatedHttp';
import { SessionEpoch } from '@/application/auth/SessionEpoch';
import { SessionService } from '@/application/auth/SessionService';
import type { AppContainer } from '@/application/container';
import type { AppLifecycle } from '@/application/ports/AppLifecycle';
import type { Connectivity } from '@/application/ports/Connectivity';
import type { Timer } from '@/application/ports/Timer';
import type { SessionStore } from '@/application/ports/SessionStore';
import type { AppServices } from '@/application/services';
import { SyncCoordinator } from '@/application/sync/SyncCoordinator';
import { UserContainers } from '@/application/userContainers';
import { currentApiBaseUrl } from '../config/apiConfig';
import { FetchHttpClient } from '../http/FetchHttpClient';
import { HttpAuthGateway } from '../http/HttpAuthGateway';
import { KeychainSessionStore } from '../security/KeychainSessionStore';
import { AppStateLifecycle } from '../sync/AppStateLifecycle';
import { NetInfoConnectivity } from '../sync/NetInfoConnectivity';
import { SystemTimer } from '../sync/SystemTimer';
import { SystemClock } from '../system/SystemClock';
import { createContainer } from './createContainer';

export interface AppServicesOptions {
  apiBaseUrl?: string;
  sessionStore?: SessionStore;
  /** Opens the database of a user; defaults to `planner_<userId>.db`. */
  openContainer?: (userId: string) => Promise<AppContainer>;
  /** Replaces the platform adapters behind sync (tests, fakes). */
  syncAdapters?: {
    connectivity?: Connectivity;
    lifecycle?: AppLifecycle;
    timer?: Timer;
  };
  /** Sync log lines (reason codes and counts); default: console in dev. */
  syncLog?: (message: string) => void;
}

/**
 * Wires HTTP, the Keychain session and the per-user database. The stored
 * session is restored right away (no network), which opens its database, so
 * the app works offline from the first frame. Throws when the build is not
 * configured (see `bootstrapApp` for the handled version).
 */
export function createAppServices(
  options: AppServicesOptions = {},
): AppServices {
  const baseUrl = options.apiBaseUrl ?? currentApiBaseUrl();
  const store = options.sessionStore ?? new KeychainSessionStore();
  const http = new FetchHttpClient({ baseUrl });
  const gateway = new HttpAuthGateway(http);

  let restoring: Promise<void> = Promise.resolve();
  const containers = new UserContainers({
    open: options.openContainer ?? (userId => createContainer({ userId })),
    whenReady: () => restoring,
  });
  // One epoch for both, so a refresh finishing after logout is discarded.
  const epoch = new SessionEpoch();
  const session = new SessionService({
    gateway,
    store,
    users: containers,
    epoch,
  });
  const authenticated = new AuthenticatedHttp({
    http,
    gateway,
    store,
    epoch,
    // Moves the session state to `expired` (see SessionService.handleExpired).
    onSessionExpired: () => session.handleExpired(),
  });

  // restore() never rejects: a storage failure becomes the `unreadable` state.
  restoring = session.restore().then(() => undefined);
  const adapters = options.syncAdapters ?? {};
  const clock = new SystemClock();
  const lifecycle = adapters.lifecycle ?? new AppStateLifecycle();
  const timer = adapters.timer ?? new SystemTimer();
  const sync = new SyncCoordinator({
    session,
    containers,
    http: authenticated,
    connectivity: adapters.connectivity ?? new NetInfoConnectivity(),
    lifecycle,
    timer,
    clock,
    random: Math.random,
    log:
      options.syncLog ??
      (__DEV__ ? message => console.log(`sync: ${message}`) : undefined),
  });
  return {
    session,
    http: authenticated,
    containers,
    sync,
    runtime: { clock, timer, lifecycle },
    ready: restoring,
  };
}
