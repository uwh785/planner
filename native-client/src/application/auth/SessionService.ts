import type {
  AuthGateway,
  LoginInput,
  RegisterInput,
} from '../ports/AuthGateway';
import type { SessionStore } from '../ports/SessionStore';
import type { AuthSession } from '@/domain/auth';
import { SessionEpoch } from './SessionEpoch';
import { stateOf } from './sessionState';
import type { SessionState } from './sessionState';
import { login, logout, register, restoreSession } from './useCases';

/** Opens the database of the signed-in user, or closes it for null. */
export interface UserSwitch {
  setUser(userId: string | null): Promise<void>;
}

/** The session use cases wired to the per-user database. */
export class SessionService {
  private session: AuthSession | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly stateListeners = new Set<() => void>();
  private readonly epoch: SessionEpoch;
  private snapshot: SessionState = { status: 'restoring' };

  constructor(
    private readonly deps: {
      gateway: AuthGateway;
      store: SessionStore;
      users: UserSwitch;
      /** Shared with AuthenticatedHttp (see SessionEpoch). */
      epoch?: SessionEpoch;
    },
  ) {
    this.epoch = deps.epoch ?? new SessionEpoch();
  }

  private get useCaseDeps() {
    const { gateway, store } = this.deps;
    return { gateway, store, epoch: this.epoch };
  }

  /** The current UI state; the same object until it changes. */
  state(): SessionState {
    return this.snapshot;
  }

  /** Subscribes to state changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** The last known session (signed-in, expired or null); not a store read. */
  current(): AuthSession | null {
    return this.session;
  }

  /**
   * Reads the stored session. A storage failure is not "signed out": it
   * becomes the `unreadable` state and nothing is overwritten. Call again to
   * retry.
   */
  async restore(): Promise<AuthSession | null> {
    this.publish({ status: 'restoring' });
    let stored: AuthSession | null;
    try {
      stored = await restoreSession(this.useCaseDeps);
    } catch {
      this.session = null;
      await this.deps.users.setUser(null);
      this.publish({ status: 'unreadable' });
      return null;
    }
    return this.adopt(stored);
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    return this.adopt(await register(this.useCaseDeps, input));
  }

  async login(input: LoginInput): Promise<AuthSession> {
    return this.adopt(await login(this.useCaseDeps, input));
  }

  async logout(): Promise<void> {
    try {
      await logout(this.useCaseDeps);
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
      this.publish(stateOf(this.session));
    }
    this.listeners.forEach(listener => listener());
  }

  // An expired session still opens its database: local data stays reachable.
  private async adopt<T extends AuthSession | null>(session: T): Promise<T> {
    this.session = session;
    await this.deps.users.setUser(session?.userId ?? null);
    this.publish(stateOf(session));
    return session;
  }

  private publish(next: SessionState): void {
    this.snapshot = next;
    this.stateListeners.forEach(listener => listener());
  }
}
