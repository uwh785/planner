import type {
  AuthGateway,
  LoginInput,
  RegisterInput,
} from '../ports/AuthGateway';
import type { SessionStore } from '../ports/SessionStore';
import type { AuthSession } from '@/domain/auth';
import { ValidationError } from '@/domain/validation';

interface AuthDeps {
  gateway: AuthGateway;
  store: SessionStore;
}

/** Server-side logout is best effort: it never delays leaving the account. */
const LOGOUT_TIMEOUT_MS = 3000;

/** Client-side basics only; the server stays the authority. */
function credentials(email: string, password: string): { email: string } {
  const trimmed = email.trim();
  if (trimmed === '') {
    throw new ValidationError('Email is required');
  }
  if (password === '') {
    throw new ValidationError('Password is required');
  }
  return { email: trimmed };
}

export async function register(
  { gateway, store }: AuthDeps,
  input: RegisterInput,
): Promise<AuthSession> {
  const { email } = credentials(input.email, input.password);
  const session = await gateway.register({
    email,
    password: input.password,
    name: input.name?.trim() ?? '',
  });
  await store.save(session);
  return session;
}

export async function login(
  { gateway, store }: AuthDeps,
  input: LoginInput,
): Promise<AuthSession> {
  const { email } = credentials(input.email, input.password);
  const session = await gateway.login({ email, password: input.password });
  await store.save(session);
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
  serverTimeoutMs = LOGOUT_TIMEOUT_MS,
}: AuthDeps & { serverTimeoutMs?: number }): Promise<void> {
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
    await store.clear();
  }
}

/** Reads the persisted session. No network, so the app opens offline. */
export function restoreSession({
  store,
}: {
  store: SessionStore;
}): Promise<AuthSession | null> {
  return store.get();
}
