import {
  HttpError,
  InvalidCredentialsError,
  NetworkError,
} from '@/application/auth/errors';
import {
  authErrorMessage as message,
  type AuthMode,
} from '@/presentation/screens/authMessages';
import { words } from '../helpers/i18n';

const authErrorMessage = (error: unknown, mode: AuthMode) =>
  message(error, mode, words('en').t);

const GENERIC = 'Something went wrong. Please try again.';

it('maps typed errors to calm, short messages', () => {
  expect(authErrorMessage(new InvalidCredentialsError(), 'signIn')).toBe(
    'Email or password is incorrect.',
  );
  expect(authErrorMessage(new NetworkError(), 'signIn')).toBe(
    'No connection. Signing in needs the internet the first time.',
  );
  expect(authErrorMessage(new NetworkError(), 'register')).toBe(
    'No connection. Creating an account needs the internet.',
  );
  expect(authErrorMessage(new HttpError(500, 'HTTP 500'), 'signIn')).toBe(
    GENERIC,
  );
  expect(authErrorMessage(new Error('boom'), 'register')).toBe(GENERIC);
});

it('surfaces the server text of register refusals (400/409) when it is safe', () => {
  expect(
    authErrorMessage(
      new HttpError(409, 'email already registered'),
      'register',
    ),
  ).toBe('Email already registered.');
  expect(
    authErrorMessage(new HttpError(400, 'password too short'), 'register'),
  ).toBe('Password too short.');
});

it('does not surface server text that is unsafe or from other flows', () => {
  expect(authErrorMessage(new HttpError(409, 'HTTP 409'), 'register')).toBe(
    GENERIC,
  );
  expect(authErrorMessage(new HttpError(500, 'pq: deadlock'), 'register')).toBe(
    GENERIC,
  );
  expect(
    authErrorMessage(new HttpError(400, 'x'.repeat(300)), 'register'),
  ).toBe(GENERIC);
  expect(authErrorMessage(new HttpError(400, 'bad request'), 'signIn')).toBe(
    GENERIC,
  );
});

it('speaks Spanish too', () => {
  const t = words('es').t;
  expect(message(new InvalidCredentialsError(), 'signIn', t)).toBe(
    'El correo o la contraseña no son correctos.',
  );
  expect(message(new NetworkError(), 'register', t)).toBe(
    'Sin conexión. Crear una cuenta necesita internet.',
  );
  expect(message(new Error('boom'), 'signIn', t)).toBe(
    'Algo salió mal. Inténtalo de nuevo.',
  );
});
