import {
  HttpError,
  InvalidCredentialsError,
  SessionExpiredError,
} from '@/application/auth/errors';
import type {
  AuthGateway,
  LoginInput,
  RegisterInput,
} from '@/application/ports/AuthGateway';
import type { HttpClient } from '@/application/ports/HttpClient';
import type { ActiveSession } from '@/domain/auth';

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Reads `{data: {token, user, refresh_token}}`; anything else is a server fault. */
function toSession(status: number, json: unknown): ActiveSession {
  const data = (json as { data?: Record<string, unknown> } | null)?.data;
  const user = data?.user as Record<string, unknown> | undefined;
  const accessToken = str(data?.token);
  const refreshToken = str(data?.refresh_token);
  const userId = str(user?.user_id);
  const email = str(user?.email);
  if (!accessToken || !refreshToken || !userId || !email) {
    throw new HttpError(status, 'Malformed authentication response');
  }
  return {
    userId,
    email,
    name: typeof user?.name === 'string' ? user.name : email,
    accessToken,
    refreshToken,
  };
}

/** The backend's own /api/auth endpoints over an HttpClient. */
export class HttpAuthGateway implements AuthGateway {
  constructor(private readonly http: HttpClient) {}

  async register(input: RegisterInput): Promise<ActiveSession> {
    const { status, json } = await this.http.request(
      'POST',
      '/api/auth/register',
      {
        body: {
          email: input.email,
          name: input.name,
          password: input.password,
        },
      },
    );
    return toSession(status, json);
  }

  async login(input: LoginInput): Promise<ActiveSession> {
    try {
      const { status, json } = await this.http.request(
        'POST',
        '/api/auth/login',
        { body: { email: input.email, password: input.password } },
      );
      return toSession(status, json);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        throw new InvalidCredentialsError();
      }
      throw error;
    }
  }

  async refresh(refreshToken: string): Promise<ActiveSession> {
    try {
      const { status, json } = await this.http.request(
        'POST',
        '/api/auth/refresh',
        { body: { refresh_token: refreshToken } },
      );
      return toSession(status, json);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        throw new SessionExpiredError();
      }
      throw error;
    }
  }

  async logout(refreshToken: string, signal?: AbortSignal): Promise<void> {
    await this.http.request('POST', '/api/auth/logout', {
      body: { refresh_token: refreshToken },
      signal,
    });
  }
}
