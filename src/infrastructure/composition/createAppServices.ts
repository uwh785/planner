import { AuthenticatedHttp } from '@/application/auth/AuthenticatedHttp';
import { SessionService } from '@/application/auth/SessionService';
import type { AppContainer } from '@/application/container';
import type { SessionStore } from '@/application/ports/SessionStore';
import type { AppServices } from '@/application/services';
import { UserContainers } from '@/application/userContainers';
import { currentApiBaseUrl } from '../config/apiConfig';
import { FetchHttpClient } from '../http/FetchHttpClient';
import { HttpAuthGateway } from '../http/HttpAuthGateway';
import { KeychainSessionStore } from '../security/KeychainSessionStore';
import { createContainer } from './createContainer';

export interface AppServicesOptions {
  apiBaseUrl?: string;
  sessionStore?: SessionStore;
  /** Opens the database of a user; defaults to `planner_<userId>.db`. */
  openContainer?: (userId: string) => Promise<AppContainer>;
}

/**
 * Wires HTTP, the Keychain session and the per-user database. The stored
 * session is restored right away (no network), which opens its database, so
 * the app works offline from the first frame.
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
  const session = new SessionService({ gateway, store, users: containers });
  const authenticated = new AuthenticatedHttp({
    http,
    gateway,
    store,
    onSessionExpired: () => session.handleExpired(),
  });

  restoring = session.restore().then(
    () => undefined,
    error => {
      console.error('session restore failed', error);
    },
  );
  return { session, http: authenticated, containers, ready: restoring };
}
