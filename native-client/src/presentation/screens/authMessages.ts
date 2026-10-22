import {
  HttpError,
  InvalidCredentialsError,
  NetworkError,
} from '@/application/auth/errors';

export type AuthMode = 'signIn' | 'register';

const GENERIC = 'Something went wrong. Please try again.';

/** Longest server text we show as is; anything longer is not a short refusal. */
const MAX_SERVER_TEXT = 120;

/**
 * The server's own wording of a register refusal (400/409, e.g. "email
 * already registered"), when it is short plain text. Other statuses and the
 * client's own `HTTP <status>` fallback stay generic.
 */
function serverRefusal(error: HttpError): string | null {
  const text = error.message.trim();
  const safe =
    (error.status === 400 || error.status === 409) &&
    text !== '' &&
    text.length <= MAX_SERVER_TEXT &&
    !/^HTTP \d+$/.test(text) &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f]/.test(text);
  if (!safe) {
    return null;
  }
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/** Turns a failed sign-in or registration into one short, calm sentence. */
export function authErrorMessage(error: unknown, mode: AuthMode): string {
  if (error instanceof InvalidCredentialsError) {
    return 'Email or password is incorrect.';
  }
  if (error instanceof NetworkError) {
    return mode === 'register'
      ? 'No connection. Creating an account needs the internet.'
      : 'No connection. Signing in needs the internet the first time.';
  }
  if (error instanceof HttpError && mode === 'register') {
    return serverRefusal(error) ?? GENERIC;
  }
  return GENERIC;
}
