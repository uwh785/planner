import type { AuthGateway } from '../ports/AuthGateway';
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
} from '../ports/HttpClient';
import type { SessionStore } from '../ports/SessionStore';
import type { AuthSession } from '@/domain/auth';
import { HttpError, SessionExpiredError, SignedOutError } from './errors';
import { SessionEpoch } from './SessionEpoch';

interface Deps {
  http: HttpClient;
  gateway: AuthGateway;
  store: SessionStore;
  /** Shared with the session use cases; defaults to a private one. */
  epoch?: SessionEpoch;
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
 * A refresh that finishes after logout or a user switch writes nothing and
 * fails the request with `SignedOutError`.
 */
export class AuthenticatedHttp {
  private refreshing: Promise<string> | null = null;
  private readonly epoch: SessionEpoch;

  constructor(private readonly deps: Deps) {
    this.epoch = deps.epoch ?? new SessionEpoch();
  }

  async request(
    method: string,
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse> {
    const startedIn = this.epoch.current();
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
      const fresh = await this.refreshAfter(session.accessToken, startedIn);
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

  private refreshAfter(
    failedToken: string,
    startedIn: number,
  ): Promise<string> {
    if (this.refreshing === null) {
      const run = this.refresh(failedToken, startedIn).finally(() => {
        this.refreshing = null;
      });
      this.refreshing = run;
    }
    return this.refreshing;
  }

  private async refresh(
    failedToken: string,
    startedIn: number,
  ): Promise<string> {
    const { store, gateway, onSessionExpired } = this.deps;
    const { epoch } = this;
    const current = await store.get();
    if (epoch.current() !== startedIn) {
      throw new SignedOutError();
    }
    if (!current?.refreshToken) {
      throw new SessionExpiredError();
    }
    // Another request may have rotated the pair after this one was sent.
    if (current.accessToken && current.accessToken !== failedToken) {
      return current.accessToken;
    }
    // Persists only if nobody signed out or switched user meanwhile.
    const persist = async (session: AuthSession): Promise<boolean> =>
      epoch.exclusive(async () => {
        if (epoch.current() !== startedIn) {
          return false;
        }
        await store.save(session);
        return true;
      });
    try {
      const next = await gateway.refresh(current.refreshToken);
      // The rotated token must be durable before it is used: the old one is dead.
      if (!(await persist(next))) {
        throw new SignedOutError();
      }
      return next.accessToken;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        const kept = await persist({
          userId: current.userId,
          email: current.email,
          name: current.name,
          accessToken: null,
          refreshToken: null,
        });
        if (!kept) {
          throw new SignedOutError();
        }
        onSessionExpired?.();
      }
      throw error;
    }
  }
}
