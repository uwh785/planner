import type { AuthSession, AuthUser } from '@/domain/auth';

/**
 * What the UI needs to know about the session:
 * - `restoring`: the stored session is being read (no network involved);
 * - `unreadable`: secure storage failed, so we do not know; offer a retry;
 * - `signedOut`: nobody is signed in;
 * - `expired`: the server refused the refresh token; the identity (and its
 *   local data) is kept, the user only has to sign in again;
 * - `signedIn`: a working token pair is stored.
 */
export type SessionState =
  | { status: 'restoring' }
  | { status: 'unreadable' }
  | { status: 'signedOut' }
  | { status: 'expired'; user: AuthUser }
  | { status: 'signedIn'; user: AuthUser };

export function stateOf(session: AuthSession | null): SessionState {
  if (session === null) {
    return { status: 'signedOut' };
  }
  const user = {
    userId: session.userId,
    email: session.email,
    name: session.name,
  };
  return session.accessToken && session.refreshToken
    ? { status: 'signedIn', user }
    : { status: 'expired', user };
}
