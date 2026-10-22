/** The server could not be reached (offline, DNS, timeout). */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** The server answered with a non-2xx status. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Login or register was refused for the given credentials. */
export class InvalidCredentialsError extends Error {
  constructor(message = 'Invalid email or password') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

/** The refresh token is no longer accepted; the user must sign in again. */
export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/** An operation that needs a signed-in user ran while nobody is. */
export class NotSignedInError extends Error {
  constructor(message = 'Not signed in') {
    super(message);
    this.name = 'NotSignedInError';
  }
}

/**
 * The user signed out (or another user signed in) while a request was in
 * flight, so it was dropped instead of acting on a session that is gone.
 */
export class SignedOutError extends Error {
  constructor(message = 'Signed out') {
    super(message);
    this.name = 'SignedOutError';
  }
}

/**
 * Secure storage failed to answer (e.g. a Keystore error). Unlike an empty
 * store this does not mean "signed out", so nothing may overwrite it.
 */
export class SessionStoreUnreadableError extends Error {
  constructor(message = 'The saved session could not be read') {
    super(message);
    this.name = 'SessionStoreUnreadableError';
  }
}
