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
