import type {
  AuthGateway,
  LoginInput,
  RegisterInput,
} from '../ports/AuthGateway';
import type { SessionStore } from '../ports/SessionStore';
import type { AuthSession } from '@/domain/auth';
import { login, logout, register, restoreSession } from './useCases';

/** Opens the database of the signed-in user, or closes it for null. */
export interface UserSwitch {
  setUser(userId: string | null): Promise<void>;
}

/** The session use cases wired to the per-user database. */
export class SessionService {
  private session: AuthSession | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly deps: {
      gateway: AuthGateway;
      store: SessionStore;
      users: UserSwitch;
    },
  ) {}

  /** The last known session (signed-in, expired or null); not a store read. */
  current(): AuthSession | null {
    return this.session;
  }

  async restore(): Promise<AuthSession | null> {
    const stored = await restoreSession(this.deps);
    return this.adopt(stored);
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    return this.adopt(await register(this.deps, input));
  }

  async login(input: LoginInput): Promise<AuthSession> {
    return this.adopt(await login(this.deps, input));
  }

  async logout(): Promise<void> {
    try {
      await logout(this.deps);
    } finally {
      await this.adopt(null);
    }
  }

  /** Subscribes to a refused refresh; returns the unsubscribe function. */
  onSessionExpired(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called by AuthenticatedHttp when the refresh token was refused. */
  handleExpired(): void {
    if (this.session) {
      this.session = {
        ...this.session,
        accessToken: null,
        refreshToken: null,
      };
    }
    this.listeners.forEach(listener => listener());
  }

  // An expired session still opens its database: local data stays reachable.
  private async adopt<T extends AuthSession | null>(session: T): Promise<T> {
    this.session = session;
    await this.deps.users.setUser(session?.userId ?? null);
    return session;
  }
}
