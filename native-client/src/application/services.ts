import type { AuthenticatedHttp } from './auth/AuthenticatedHttp';
import type { SessionService } from './auth/SessionService';
import type { ContainerSource } from './container';
import type { SyncCoordinator } from './sync/SyncCoordinator';

/** Everything the app needs once built: session, authenticated HTTP, data. */
export interface AppServices {
  session: SessionService;
  /** For sync work; adds the bearer token and refreshes it on 401. */
  http: AuthenticatedHttp;
  /** The database of whoever is signed in (see UserContainers). */
  containers: ContainerSource;
  /**
   * Runs sync for whoever is signed in once `start()` is called; also the
   * status the UI shows. Built but not started, so tests and dev smokes that
   * create their own services never sync by accident.
   */
  sync: SyncCoordinator;
  /** Settles once the stored session has been restored (never rejects). */
  ready: Promise<void>;
}

/**
 * Result of building the services at startup. A build that cannot start
 * (e.g. a release without an API URL) is `fatal` with a plain, secret-free
 * message, so the app can still register and explain instead of crashing.
 */
export type AppBoot =
  | { kind: 'ready'; services: AppServices }
  | { kind: 'fatal'; message: string };
