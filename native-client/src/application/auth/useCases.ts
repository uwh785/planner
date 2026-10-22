import type {
  AuthGateway,
  LoginInput,
  RegisterInput,
} from '../ports/AuthGateway';
import type { SessionStore } from '../ports/SessionStore';
import type { AuthSession } from '@/domain/auth';
import { credentials } from './credentials';
import { SessionEpoch } from './SessionEpoch';

interface AuthDeps {
  gateway: AuthGateway;
  store: SessionStore;
  /** Shared with AuthenticatedHttp so stale refreshes are discarded. */
  epoch?: SessionEpoch;
}

/** Persists a freshly issued session, invalidating work of the old identity. */
async function adoptSession(
  { store, epoch = new SessionEpoch() }: AuthDeps,
  session: AuthSession,
): Promise<void> {
  epoch.advance();
  await epoch.exclusive(() => store.save(session));
}

/** Server-side logout is best effort: it never delays leaving the account. */
const LOGOUT_TIMEOUT_MS = 3000;

export async function register(
  deps: AuthDeps,
  input: RegisterInput,
): Promise<AuthSession> {
  const { gateway } = deps;
  const { email } = credentials(input.email, input.password);
  const session = await gateway.register({
    email,
    password: input.password,
    name: input.name?.trim() ?? '',
  });
  await adoptSession(deps, session);
  return session;
}

export async function login(
  deps: AuthDeps,
  input: LoginInput,
): Promise<AuthSession> {
  const { gateway } = deps;
  const { email } = credentials(input.email, input.password);
  const session = await gateway.login({ email, password: input.password });
  await adoptSession(deps, session);
  return session;
}

/**
 * Leaves the account. Secure storage is always cleared, whatever the server
 * says. The local database and the outbox are not touched: unsynced changes
 * stay on the device for the next sign-in of the same user.
 */
export async function logout({
  gateway,
  store,
  epoch = new SessionEpoch(),
  serverTimeoutMs = LOGOUT_TIMEOUT_MS,
}: AuthDeps & { serverTimeoutMs?: number }): Promise<void> {
  // First, so a refresh still in flight cannot write tokens back.
  epoch.advance();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverTimeoutMs);
  try {
    const session = await store.get();
    if (session?.refreshToken) {
      await gateway.logout(session.refreshToken, controller.signal);
    }
  } catch {
    // Best effort: the refresh token also expires on its own.
  } finally {
    clearTimeout(timer);
    await epoch.exclusive(() => store.clear());
  }
}

/**
 * Reads the persisted session. No network, so the app opens offline. Throws
 * `SessionStoreUnreadableError` when secure storage cannot answer: that is
 * different from `null` (nobody is signed in).
 */
export function restoreSession({
  store,
}: {
  store: SessionStore;
}): Promise<AuthSession | null> {
  return store.get();
}
