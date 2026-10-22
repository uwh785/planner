import type { AuthGateway } from '@/application/ports/AuthGateway';
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
} from '@/application/ports/HttpClient';
import type { SessionStore } from '@/application/ports/SessionStore';
import type { ActiveSession, AuthSession } from '@/domain/auth';

/** Session store that records every write, for ordering assertions. */
export class InMemorySessionStore implements SessionStore {
  readonly log: string[] = [];
  constructor(public value: AuthSession | null = null) {}
  async get(): Promise<AuthSession | null> {
    return this.value;
  }
  async save(session: AuthSession): Promise<void> {
    this.value = { ...session };
    this.log.push(`save:${session.refreshToken ?? 'null'}`);
  }
  async clear(): Promise<void> {
    this.value = null;
    this.log.push('clear');
  }
}

export const user = { userId: 'usr_1', email: 'a@b.co', name: 'Ann' };

export function active(
  accessToken = 'access-1',
  refreshToken = 'refresh-1',
): ActiveSession {
  return { ...user, accessToken, refreshToken };
}

export type Handler = (
  method: string,
  path: string,
  options: HttpRequestOptions,
) => Promise<HttpResponse>;

/** HttpClient driven by a function; records the calls it saw. */
export class FakeHttpClient implements HttpClient {
  readonly calls: { method: string; path: string; auth?: string }[] = [];
  constructor(private readonly handler: Handler) {}
  request(
    method: string,
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse> {
    this.calls.push({ method, path, auth: options.headers?.Authorization });
    return this.handler(method, path, options);
  }
}

export class FakeAuthGateway implements AuthGateway {
  readonly calls: string[] = [];
  register = jest.fn(async (): Promise<ActiveSession> => active());
  login = jest.fn(async (): Promise<ActiveSession> => active());
  refresh = jest.fn(
    async (_token: string): Promise<ActiveSession> =>
      active('access-2', 'refresh-2'),
  );
  logout = jest.fn(async (_token: string): Promise<void> => undefined);
}
