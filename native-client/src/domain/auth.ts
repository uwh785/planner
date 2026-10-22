/** Who is signed in, as the backend reports them. */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

/**
 * What the device remembers about the signed-in user. Both tokens are null
 * once the server refused a refresh: the identity stays so the app can say
 * "session expired" and keep the user's local data reachable.
 */
export interface AuthSession extends AuthUser {
  accessToken: string | null;
  refreshToken: string | null;
}

/** A session that holds a working token pair, as the server just issued it. */
export interface ActiveSession extends AuthUser {
  accessToken: string;
  refreshToken: string;
}
