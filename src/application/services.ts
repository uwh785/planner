import type { AuthenticatedHttp } from './auth/AuthenticatedHttp';
import type { SessionService } from './auth/SessionService';
import type { ContainerSource } from './container';

/** Everything the app needs once built: session, authenticated HTTP, data. */
export interface AppServices {
  session: SessionService;
  /** For sync work; adds the bearer token and refreshes it on 401. */
  http: AuthenticatedHttp;
  /** The database of whoever is signed in (see UserContainers). */
  containers: ContainerSource;
  /** Settles once the stored session has been restored (never rejects). */
  ready: Promise<void>;
}
