import {
  HttpError,
  InvalidCredentialsError,
  NetworkError,
} from '@/application/auth/errors';

import type { Translate } from '../i18n/I18nProvider';

export type AuthMode = 'signIn' | 'register';

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

/**
 * Turns a failed sign-in or registration into one short, calm sentence. The
 * server's own refusal text (registration only) is shown as the server
 * words it, which is English.
 */
export function authErrorMessage(
  error: unknown,
  mode: AuthMode,
  t: Translate,
): string {
  if (error instanceof InvalidCredentialsError) {
    return t('authInvalidCredentials');
  }
  if (error instanceof NetworkError) {
    return t(
      mode === 'register'
        ? 'authNoConnectionRegister'
        : 'authNoConnectionSignIn',
    );
  }
  if (error instanceof HttpError && mode === 'register') {
    return serverRefusal(error) ?? t('authGeneric');
  }
  return t('authGeneric');
}
