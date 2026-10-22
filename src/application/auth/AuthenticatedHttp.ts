import type { AuthGateway } from '../ports/AuthGateway';
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
} from '../ports/HttpClient';
import type { SessionStore } from '../ports/SessionStore';
import { HttpError, SessionExpiredError } from './errors';

interface Deps {
  http: HttpClient;
  gateway: AuthGateway;
  store: SessionStore;
  /** Called once when the server refuses the refresh token. */
  onSessionExpired?: () => void;
}

/**
 * Sends requests with the stored access token. On a 401 it refreshes once
 * (concurrent 401s share one refresh), persists the rotated token pair and
 * retries the request once with the new access token.
 *
 * A refused refresh clears the tokens but keeps the identity and local data;
 * a network or server failure during refresh leaves the session untouched.
 */
export class AuthenticatedHttp {
  private refreshing: Promise<string> | null = null;

  constructor(private readonly deps: Deps) {}

  async request(
    method: string,
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse> {
    const session = await this.deps.store.get();
    if (!session?.accessToken) {
      throw new SessionExpiredError();
    }
    try {
      return await this.send(method, path, options, session.accessToken);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 401) {
        throw error;
      }
      const fresh = await this.refreshAfter(session.accessToken);
      return this.send(method, path, options, fresh);
    }
  }

  private send(
    method: string,
    path: string,
    options: HttpRequestOptions,
    accessToken: string,
  ): Promise<HttpResponse> {
    return this.deps.http.request(method, path, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
    });
  }

  private refreshAfter(failedToken: string): Promise<string> {
    if (this.refreshing === null) {
      const run = this.refresh(failedToken).finally(() => {
        this.refreshing = null;
      });
      this.refreshing = run;
    }
    return this.refreshing;
  }

  private async refresh(failedToken: string): Promise<string> {
    const { store, gateway, onSessionExpired } = this.deps;
    const current = await store.get();
    if (!current?.refreshToken) {
      throw new SessionExpiredError();
    }
    // Another request may have rotated the pair after this one was sent.
    if (current.accessToken && current.accessToken !== failedToken) {
      return current.accessToken;
    }
    try {
      const next = await gateway.refresh(current.refreshToken);
      // The rotated token must be durable before it is used: the old one is dead.
      await store.save(next);
      return next.accessToken;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await store.save({
          userId: current.userId,
          email: current.email,
          name: current.name,
          accessToken: null,
          refreshToken: null,
        });
        onSessionExpired?.();
      }
      throw error;
    }
  }
}
